import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { users } from "./users";

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  keywords: text("keywords").array().default([]),
  searchLocation: text("search_location"),
  searchLanguage: varchar("search_language", { length: 10 }),

  remoteOnly: boolean("remote_only").default(true),
  jobTypes: text("job_types").array().default([]),

  emailNotifications: boolean("email_notifications").default(false),
  careerChecklist: jsonb("career_checklist")
    .$type<
      Array<{
        id: string;
        title: string;
        month: string;
        items: Array<{ id: string; label: string; checked: boolean }>;
      }>
    >()
    .default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserPreferences = InferSelectModel<typeof userPreferences>;
export type NewUserPreferences = InferInsertModel<typeof userPreferences>;
