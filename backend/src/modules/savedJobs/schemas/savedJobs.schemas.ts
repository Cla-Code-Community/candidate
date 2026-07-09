import { z } from "zod";

export const createSavedJobSchema = z.object({
  jobLink: z.string().url(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  keyword: z.string().optional(),
  status: z
    .enum(["saved", "applied", "interviewing", "rejected", "accepted"])
    .optional(),
  appliedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const updateSavedJobSchema = createSavedJobSchema.partial();

export type CreateSavedJobInput = z.infer<typeof createSavedJobSchema>;
export type UpdateSavedJobInput = z.infer<typeof updateSavedJobSchema>;
