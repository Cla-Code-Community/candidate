import { z } from "zod";

export const MentorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  rating: z.number().int().min(0).max(5),
  completed: z.number().int().min(0),
  days: z.string().min(1),
  hours: z.string().min(1),
  nextSessionDate: z.string().min(1),
  specialty: z.string().min(1),
  avatarColor: z.string().min(1),
  platform: z.enum(["Zoom", "Google Meet", "Microsoft Teams", "Discord"]),
  platformUrl: z.string().url(),
  agenda: z.string().min(1),
});

export type Mentor = z.infer<typeof MentorSchema>;
