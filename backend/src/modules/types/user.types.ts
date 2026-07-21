import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { userPreferences } from "../../db/schema/userPreferences.js";
import { users } from "../../db/schema/users.js";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserPreferences = InferSelectModel<typeof userPreferences>;

export type UpdateProfileData = Partial<
  Pick<
    NewUser,
    | "displayName"
    | "firstName"
    | "lastName"
    | "avatarUrl"
    | "username"
    | "phone"
    | "cpf"
    | "technologies"
    | "technologyExperiencesEncrypted"
    | "level"
  >
> & {
  technologyExperiences?: Array<{ name: string; years: number }> | null;
};
