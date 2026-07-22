import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { NewSavedJob, SavedJob, savedJobs } from "../../db/schema";
import { DB } from "../../db/types/types";
import { ownedBy } from "../../lib/authorization/ownership";
import { AppError } from "../../lib/errors";
import { NotificationsService } from "../notifications/notifications.service";

export class SavedJobsService {
  constructor(private readonly tx: DB = db) {}

  async getAll(userId: string): Promise<SavedJob[]> {
    return this.tx.query.savedJobs.findMany({
      where: (j) => ownedBy(userId, j.userId),
      orderBy: (j, { desc }) => desc(j.createdAt),
    });
  }

  async getById(userId: string, jobId: string): Promise<SavedJob | undefined> {
    return this.tx.query.savedJobs.findFirst({
      where: (j, { and, eq }) => and(ownedBy(userId, j.userId), eq(j.id, jobId)),
    });
  }

  async create(
    userId: string,
    data: Omit<NewSavedJob, "userId">,
  ): Promise<SavedJob> {
    const existing = await this.tx.query.savedJobs.findFirst({
      where: (j, { and, eq }) =>
        and(ownedBy(userId, j.userId), eq(j.jobLink, data.jobLink)),
    });

    if (existing) {
      throw AppError.conflict("Vaga já salva.");
    }

    const result = await this.tx
      .insert(savedJobs)
      .values({ ...data, userId })
      .returning();
    await new NotificationsService(this.tx).createForSavedJob(userId, result[0]);
    return result[0];
  }

  async update(
    userId: string,
    jobId: string,
    data: Partial<NewSavedJob>,
  ): Promise<SavedJob> {
    const previous = await this.getById(userId, jobId);
    if (!previous) {
      throw AppError.notFound("Vaga não encontrada");
    }

    const result = await this.tx
      .update(savedJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(savedJobs.id, jobId), ownedBy(userId, savedJobs.userId)))
      .returning();

    if (!result[0]) {
      throw AppError.notFound("Vaga não encontrada");
    }
    await new NotificationsService(this.tx).createForJobStatusChange(
      userId,
      previous,
      result[0],
    );
    return result[0];
  }

  async delete(userId: string, jobId: string): Promise<void> {
    await this.tx
      .delete(savedJobs)
      .where(and(eq(savedJobs.id, jobId), ownedBy(userId, savedJobs.userId)));
  }
}
