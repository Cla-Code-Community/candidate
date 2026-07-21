import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "support",
  "admin",
  "super_admin",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    firstName: text("first_name"),
    firstNameEncrypted: text("first_name_encrypted"),
    lastName: text("last_name"),
    lastNameEncrypted: text("last_name_encrypted"),

    displayName: text("display_name"),
    displayNameEncrypted: text("display_name_encrypted"),
    username: text("username"),

    email: text("email"),
    emailEncrypted: text("email_encrypted"),
    emailHash: text("email_hash"),
    emailVerified: boolean("email_verified").default(false).notNull(),

    avatarUrl: text("avatar_url"),
    avatarUrlEncrypted: text("avatar_url_encrypted"),
    phone: varchar("phone", { length: 20 }),
    phoneEncrypted: text("phone_encrypted"),
    cpf: varchar("cpf", { length: 14 }),
    cpfEncrypted: text("cpf_encrypted"),
    cpfHash: text("cpf_hash"),
    technologies: text("technologies").array().default([]),
    technologiesEncrypted: text("technologies_encrypted"),
    technologyExperiencesEncrypted: text("technology_experiences_encrypted"),
    level: varchar("level", { length: 50 }),
    levelEncrypted: text("level_encrypted"),

    role: userRoleEnum("role").default("user").notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    emailHashUnique: uniqueIndex("users_email_hash_unique").on(
      table.emailHash,
    ),
  }),
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
