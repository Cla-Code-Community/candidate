import { logWarn } from "../../../logger";
import { NotificationsService } from "../../notifications/notifications.service";
import { UsersService } from "../../users/users.service";
import { MatchTechnology } from "../types/jobSearch.types";
import {
  getUserMatchTechnologies,
  MatchableJob,
  MatchedJob,
  scoreJobWithTechnologies,
} from "./jobMatch.service";

export class JobProfileMatchService {
  async getUserTechnologies(userId?: string): Promise<MatchTechnology[]> {
    if (!userId) return [];

    try {
      const user = await new UsersService().getUserById(userId);
      return getUserMatchTechnologies(user);
    } catch (error) {
      logWarn("Não foi possível carregar perfil para cálculo de match", {
        userId,
        error: (error as Error).message,
      });

      return [];
    }
  }

  async enrich(
    userId: string | undefined,
    jobs: MatchableJob[],
    technologies: MatchTechnology[],
    options: { notifyHighMatches?: boolean } = {},
  ): Promise<MatchedJob[]> {
    if (technologies.length === 0) {
      return jobs as MatchedJob[];
    }

    const matchedJobs = jobs.map((job) =>
      scoreJobWithTechnologies(job, technologies),
    );

    if (options.notifyHighMatches !== false) {
      await this.notifyHighMatches(userId, matchedJobs);
    }

    return matchedJobs;
  }

  private async notifyHighMatches(
    userId: string | undefined,
    jobs: MatchedJob[],
  ): Promise<void> {
    if (!userId) return;

    const notifications = new NotificationsService();

    await Promise.all(
      jobs
        .filter((job) => (job.matchScore ?? 0) >= 85)
        .map((job) =>
          notifications.createHighMatchIfMissing(userId, job).catch((error) => {
            logWarn("Não foi possível registrar notificação de alto match", {
              error: (error as Error).message,
              userId,
              job: job.title ?? job.jobTitle ?? job.id,
            });
          }),
        ),
    );
  }
}
