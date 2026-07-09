import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { users } from "./users";

export const keywords = pgTable(
  "keywords",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    keyword: text("keyword").notNull(),
    source: text("source", { enum: ["user", "scraper"] })
      .default("user")
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userKeywordUnique: uniqueIndex("keywords_user_keyword_unique").on(
      table.userId,
      table.keyword,
    ),
  }),
);

export type Keyword = InferSelectModel<typeof keywords>;
export type NewKeyword = InferInsertModel<typeof keywords>;
