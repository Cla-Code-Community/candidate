import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { NewUserNotification, SavedJob, userNotifications } from "../../db/schema";
import { DB } from "../../db/types/types";
import { AppError } from "../../lib/errors";
import {
  jobNotificationIdentity,
  MatchedJob,
} from "../jobs/jobMatch.service";
import { ListNotificationsQuery } from "./schemas/notifications.schemas";

const statusLabels: Record<string, string> = {
  saved: "Salva",
  applied: "Candidatura enviada",
  interviewing: "Em entrevista",
  rejected: "Não selecionada",
  accepted: "Aprovada",
};

function jobName(job: Pick<SavedJob, "jobTitle" | "company">) {
  const title = job.jobTitle?.trim() || "vaga";
  const company = job.company?.trim();
  return company ? `${title} na ${company}` : title;
}

export class NotificationsService {
  constructor(private readonly tx: DB = db) {}

  async list(userId: string, filters: ListNotificationsQuery) {
    const conditions = [eq(userNotifications.userId, userId)];

    if (filters.channel) {
      conditions.push(eq(userNotifications.channel, filters.channel));
    }

    if (filters.unreadOnly) {
      conditions.push(isNull(userNotifications.readAt));
    }

    const where = and(...conditions);
    const [items, unreadRows] = await Promise.all([
      this.tx
        .select()
        .from(userNotifications)
        .where(where)
        .orderBy(desc(userNotifications.createdAt))
        .limit(filters.limit),
      this.tx
        .select({ value: count() })
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.userId, userId),
            filters.channel
              ? eq(userNotifications.channel, filters.channel)
              : undefined,
            isNull(userNotifications.readAt),
          ),
        ),
    ]);

    return {
      notifications: items,
      unreadCount: Number(unreadRows[0]?.value ?? 0),
    };
  }

  async create(data: NewUserNotification) {
    const result = await this.tx.insert(userNotifications).values(data).returning();
    return result[0];
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.tx
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, notificationId),
          eq(userNotifications.userId, userId),
        ),
      )
      .returning();

    if (!result[0]) {
      throw AppError.notFound("Notificação não encontrada");
    }

    return result[0];
  }

  async markAllRead(userId: string, channel?: "notification" | "message") {
    const result = await this.tx
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          channel ? eq(userNotifications.channel, channel) : undefined,
          isNull(userNotifications.readAt),
        ),
      )
      .returning({ id: userNotifications.id });

    return { updated: result.length };
  }

  async clear(userId: string, channel?: "notification" | "message") {
    const result = await this.tx
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          channel ? eq(userNotifications.channel, channel) : undefined,
        ),
      )
      .returning({ id: userNotifications.id });

    return { deleted: result.length };
  }

  async createForSavedJob(userId: string, job: SavedJob) {
    const type = job.status === "applied" ? "job_applied" : "job_saved";
    const title =
      job.status === "applied" ? "Candidatura enviada" : "Vaga salva";
    const message =
      job.status === "applied"
        ? `Sua candidatura para ${jobName(job)} foi registrada.`
        : `${jobName(job)} foi adicionada às suas vagas salvas.`;

    return this.create({
      userId,
      channel: "notification",
      type,
      title,
      message,
      entityType: "job",
      entityId: job.id,
      metadata: {
        jobLink: job.jobLink,
        jobTitle: job.jobTitle,
        company: job.company,
        status: job.status,
      },
    });
  }

  async createForJobStatusChange(
    userId: string,
    previous: SavedJob,
    next: SavedJob,
  ) {
    if (previous.status === next.status) return null;

    return this.create({
      userId,
      channel: "notification",
      type: next.status === "applied" ? "job_applied" : "job_status_changed",
      title: "Status de candidatura atualizado",
      message: `${jobName(next)} agora está em "${
        statusLabels[next.status] ?? next.status
      }".`,
      entityType: "job",
      entityId: next.id,
      metadata: {
        jobLink: next.jobLink,
        jobTitle: next.jobTitle,
        company: next.company,
        previousStatus: previous.status,
        status: next.status,
      },
    });
  }

  async createHighMatchIfMissing(userId: string, job: MatchedJob) {
    if ((job.matchScore ?? 0) < 85) return null;

    const entityId = jobNotificationIdentity(job);
    if (!entityId) return null;

    const existing = await this.tx.query.userNotifications.findFirst({
      where: (notification, { and, eq }) =>
        and(
          eq(notification.userId, userId),
          eq(notification.type, "high_match"),
          eq(notification.entityType, "job"),
          eq(notification.entityId, entityId),
        ),
    });

    if (existing) return existing;

    const title = job.title?.trim() || job.jobTitle?.trim() || "vaga";
    const company = job.company?.trim();
    const namedJob = company ? `${title} na ${company}` : title;

    return this.create({
      userId,
      channel: "notification",
      type: "high_match",
      title: "Vaga com alto match encontrada",
      message: `${namedJob} tem ${job.matchScore}% de compatibilidade com o seu perfil.`,
      entityType: "job",
      entityId,
      metadata: {
        jobLink: entityId,
        jobTitle: title,
        company: job.company,
        matchScore: job.matchScore,
        matchedTechnologies: job.matchedTechnologies ?? [],
      },
    });
  }
}
