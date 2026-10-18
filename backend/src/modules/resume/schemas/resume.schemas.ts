import { z } from "zod";

const experienceSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  period: z.string().max(100).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  current: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  stack: z.array(z.string().max(80)).max(40).optional(),
});

const educationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200).optional(),
  field: z.string().max(200).optional(),
  period: z.string().max(100).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  current: z.boolean().optional(),
});

export const generateResumeSchema = z.object({
  format: z.enum(["docx", "pdf", "md"]).default("docx"),
  // Dados pessoais confirmados pelo candidato (têm precedência sobre o perfil).
  name: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  portfolio: z.string().max(300).optional(),
  jobTitle: z.string().max(200).optional(),
  // Capped below the app-wide 16kb JSON body limit (see app.ts).
  jobDescription: z.string().max(12000).optional(),
  jobUrl: z.string().url().max(500).optional(),
  language: z.string().max(10).optional(),
  githubUrl: z.string().max(300).optional(),
  linkedinUrl: z.string().max(300).optional(),
  // "Sobre" do LinkedIn colado pelo candidato (base do resumo profissional).
  about: z.string().max(4000).optional(),
  experiences: z.array(experienceSchema).max(20).optional(),
  education: z.array(educationSchema).max(20).optional(),
});

export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;

// Render do conteúdo já produzido no preview (sem IA). O ats-forge valida a forma
// completa do `resume`; aqui só garantimos o envelope.
export const renderResumeSchema = z.object({
  resume: z.object({ name: z.string().min(1).max(200) }).passthrough(),
  format: z.enum(["docx", "pdf", "md"]).default("pdf"),
  filename: z.string().max(120).optional(),
  atsScore: z.number().min(0).max(100).nullable().optional(),
});

export type RenderResumeData = z.infer<typeof renderResumeSchema>;

export type GenerateResumeData = z.infer<typeof generateResumeSchema>;
