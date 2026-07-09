import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { userRoleEnum } from "./users";

export const permissionRules = pgTable(
  "permission_rules",
  {
    resource: varchar("resource", { length: 50 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    minRole: userRoleEnum("min_role").notNull(),
    reason: text("reason"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.resource, table.action] }),
  }),
);

export type PermissionRule = InferSelectModel<typeof permissionRules>;
export type NewPermissionRule = InferInsertModel<typeof permissionRules>;
