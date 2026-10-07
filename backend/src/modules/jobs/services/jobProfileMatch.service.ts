import { logWarn } from "../../../logger";
import { NotificationsService } from "../../notifications/notifications.service";
import { UsersService } from "../../users/users.service";
import { updatePreferencesSchema } from "../../users/schemas/user.schemas";
import { MatchTechnology } from "../types/jobSearch.types";
import {
  getUserMatchTechnologies,
  MatchableJob,
  MatchedJob,
  scoreProfessionalJob,
  type MatchPreferences,
} from "./jobMatch.service";

export class JobProfileMatchService {
  async getUserTechnologies(
    userId?: string,
    capture?: (preferences: MatchPreferences) => void,
  ): Promise<MatchTechnology[]> {
    if (!userId) return [];

    try {
      const usersService = new UsersService();
      const user = await usersService.getUserById(userId);
      if (capture && user) {
        const preferences: MatchPreferences = {
          seniority: user.level ?? undefined,
        };
        try {
          const saved = await usersService.getPreferences(userId);
          if (saved) {
            preferences.location = saved.searchLocation ?? undefined;
            preferences.modality = saved.remoteOnly ? "remoto" : undefined;
            // Despite its name, jobTypes is the HTTP modality enum. Validate
            // persisted text[] too; legacy contract values must not become
            // modalities. This model has no authoritative contract/family field.
            const modalities = updatePreferencesSchema.shape.jobTypes.safeParse(
              saved.jobTypes ?? [],
            );
            preferences.modalities = modalities.success
              ? (modalities.data ?? [])
              : [];
            // Keywords are free search terms, not canonical family selections.
            preferences.skills = (saved.keywords ?? []).map((name) => ({
              name,
              years: 1,
            }));
          }
        } catch {
          logWarn(
            "Não foi possível carregar preferências para cálculo de match",
          );
        }
        if (Object.values(preferences).some(Boolean)) capture(preferences);
      }
      return getUserMatchTechnologies(user);
    } catch (error) {
      logWarn("Não foi possível carregar perfil para cálculo de match", {
        code: "PROFILE_READ_FAILED",
      });

      return [];
    }
  }

  async enrich(
    userId: string | undefined,
    jobs: MatchableJob[],
    technologies: MatchTechnology[],
    options: {
      notifyHighMatches?: boolean;
      preferences?: MatchPreferences;
    } = {},
  ): Promise<MatchedJob[]> {
    if (!technologies.length && !options.preferences)
      return jobs as MatchedJob[];
    const matchedJobs = jobs.map((job) =>
      scoreProfessionalJob(job, technologies, options.preferences),
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
              code: "MATCH_NOTIFICATION_FAILED",
            });
          }),
        ),
    );
  }
}
