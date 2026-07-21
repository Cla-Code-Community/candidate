import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  channel: z.enum(["notification", "message"]).optional(),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const markAllNotificationsReadQuerySchema = z.object({
  channel: z.enum(["notification", "message"]).optional(),
});

export const clearNotificationsQuerySchema = z.object({
  channel: z.enum(["notification", "message"]).optional(),
});
