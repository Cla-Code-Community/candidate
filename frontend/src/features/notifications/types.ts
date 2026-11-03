import { z } from "zod";

export const NotificationSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  text: z.string().min(1),
  type: z.enum(["info", "success", "match"]),
  date: z.string().min(1),
  jobId: z.string().optional(),
  isRead: z.boolean().optional(),
});

export const MessageSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  sender: z.string().min(1),
  text: z.string().min(1),
  date: z.string().min(1),
  origin: z.enum(["recruiter", "mentor", "system"]).optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type MessageOrigin = NonNullable<Message["origin"]>;
