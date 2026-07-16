import { z } from "zod";

export const UserProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().or(z.literal("")),
  phone: z.string().min(1),
  level: z.string().min(1),
  technologies: z.array(z.string()),
});

export const SearchPreferencesSchema = z.object({
  keywords: z.array(z.string()),
  searchLocation: z.string().min(1),
  remoteOnly: z.boolean(),
  emailNotifications: z.boolean(),
});

export const NotificationSchema = z.object({
  id: z.number().int(),
  text: z.string().min(1),
  type: z.enum(["info", "success", "match"]),
  date: z.string().min(1),
});

export const MessageSchema = z.object({
  id: z.number().int(),
  sender: z.string().min(1),
  text: z.string().min(1),
  date: z.string().min(1),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SearchPreferences = z.infer<typeof SearchPreferencesSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Message = z.infer<typeof MessageSchema>;
