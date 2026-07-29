import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "notification",
  "message",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "job_saved",
  "job_applied",
  "job_status_changed",
  "high_match",
  "mentor",
  "system",
]);

export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    channel: notificationChannelEnum("channel").default("notification").notNull(),
    type: notificationTypeEnum("type").notNull(),

    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index("user_notifications_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    userReadAtIdx: index("user_notifications_user_read_at_idx").on(
      table.userId,
      table.readAt,
    ),
  }),
);

export type UserNotification = InferSelectModel<typeof userNotifications>;
export type NewUserNotification = InferInsertModel<typeof userNotifications>;
