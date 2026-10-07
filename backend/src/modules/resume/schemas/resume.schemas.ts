import { z } from "zod";

const experienceSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  period: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  stack: z.array(z.string().max(80)).max(40).optional(),
});

export const generateResumeSchema = z.object({
  format: z.enum(["docx", "pdf", "md"]).default("docx"),
  jobTitle: z.string().max(200).optional(),
  // Capped below the app-wide 16kb JSON body limit (see app.ts).
  jobDescription: z.string().max(12000).optional(),
  jobUrl: z.string().url().max(500).optional(),
  language: z.string().max(10).optional(),
  githubUrl: z.string().max(300).optional(),
  linkedinUrl: z.string().max(300).optional(),
  experiences: z.array(experienceSchema).max(20).optional(),
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

export type GenerateResumeData = z.infer<typeof generateResumeSchema>;
