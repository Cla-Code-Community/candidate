import { z } from "zod";

export const TechnologyExperienceSchema = z.object({
  name: z.string().min(1),
  years: z.number().min(0),
});

export const CareerChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  checked: z.boolean(),
});

export const CareerChecklistSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  month: z.string().min(1),
  items: z.array(CareerChecklistItemSchema),
});

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
  technologyExperiences: z.array(TechnologyExperienceSchema),
});

export const SearchPreferencesSchema = z.object({
  keywords: z.array(z.string()),
  searchLocation: z.string().min(1),
  remoteOnly: z.boolean(),
  emailNotifications: z.boolean(),
  careerChecklist: z.array(CareerChecklistSchema),
});

export const NotificationSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  text: z.string().min(1),
  type: z.enum(["info", "success", "match"]),
  date: z.string().min(1),
});

export const MessageSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  sender: z.string().min(1),
  text: z.string().min(1),
  date: z.string().min(1),
  origin: z.enum(["recruiter", "mentor", "system"]).optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SearchPreferences = z.infer<typeof SearchPreferencesSchema>;
export type TechnologyExperience = z.infer<typeof TechnologyExperienceSchema>;
export type CareerChecklist = z.infer<typeof CareerChecklistSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type MessageOrigin = NonNullable<Message["origin"]>;
