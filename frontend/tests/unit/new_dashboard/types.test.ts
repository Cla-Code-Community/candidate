import * as dashboardTypes from "@/domains/new_dashboard/types";
import {
    JobLevelSchema,
    JobSchema,
    JobStatusSchema,
    JobTypeSchema,
    NewJobSchema,
} from "@/domains/new_dashboard/types/job";
import { MentorSchema } from "@/domains/new_dashboard/types/mentor";
import {
    CareerChecklistSchema,
    MessageSchema,
    NotificationSchema,
    SearchPreferencesSchema,
    TechnologyExperienceSchema,
    UserProfileSchema,
} from "@/domains/new_dashboard/types/user";
import { describe, expect, it } from "vitest";

const validJob = {
  id: "job-1",
  jobTitle: "Backend Developer",
  company: "Example Co",
  location: "Remote",
  salary: "A combinar",
  type: "Remoto",
  level: "Pleno",
  matchScore: 85,
  tags: ["Go", "PostgreSQL"],
  posted: "Hoje",
  status: "saved",
  jobLink: "https://example.com/jobs/1",
  source: "Example",
  notes: "",
};

const validMentor = {
  id: "mentor-1",
  name: "Alex Mentor",
  rating: 5,
  completed: 12,
  days: "Segunda a sexta",
  hours: "09:00-17:00",
  nextSessionDate: "Amanhã",
  specialty: "Backend",
  avatarColor: "#117744",
  platform: "Google Meet",
  platformUrl: "https://meet.google.com/abc-defg-hij",
  agenda: "https://example.com/agenda",
};

describe("new_dashboard runtime types", () => {
  it("re-exports public schemas from the types barrel", () => {
    expect(dashboardTypes.JobSchema).toBe(JobSchema);
    expect(dashboardTypes.JobStatusSchema).toBe(JobStatusSchema);
    expect(dashboardTypes.JobTypeSchema).toBe(JobTypeSchema);
    expect(dashboardTypes.JobLevelSchema).toBe(JobLevelSchema);
    expect(dashboardTypes.NewJobSchema).toBe(NewJobSchema);
    expect(dashboardTypes.MentorSchema).toBe(MentorSchema);
    expect(dashboardTypes.UserProfileSchema).toBe(UserProfileSchema);
    expect(dashboardTypes.SearchPreferencesSchema).toBe(SearchPreferencesSchema);
    expect(dashboardTypes.TechnologyExperienceSchema).toBe(
      TechnologyExperienceSchema,
    );
    expect(dashboardTypes.CareerChecklistSchema).toBe(CareerChecklistSchema);
    expect(dashboardTypes.NotificationSchema).toBe(NotificationSchema);
    expect(dashboardTypes.MessageSchema).toBe(MessageSchema);
  });

  it("validates jobs, form input, enums, score bounds, and optional payload", () => {
    expect(JobSchema.parse({ ...validJob, rawPayload: { sourceId: 7 } })).toMatchObject(
      validJob,
    );
    expect(JobSchema.parse(validJob).rawPayload).toBeUndefined();
    expect(JobSchema.safeParse({ ...validJob, matchScore: 101 }).success).toBe(
      false,
    );
    expect(JobTypeSchema.safeParse("Híbrido").success).toBe(true);
    expect(JobTypeSchema.safeParse("Flexível").success).toBe(false);
    expect(JobLevelSchema.safeParse("Sênior").success).toBe(true);
    expect(JobStatusSchema.safeParse("interviewing").success).toBe(true);

    expect(
      NewJobSchema.safeParse({
        jobTitle: "Dev",
        company: "Example",
        location: "",
        salary: "",
        type: "Remoto",
        level: "Júnior",
        tags: "Go, SQL",
        source: "",
        jobLink: "",
        notes: "",
      }).success,
    ).toBe(true);
    expect(NewJobSchema.safeParse({ ...validJob, jobTitle: "" }).success).toBe(
      false,
    );
  });

  it("validates mentor limits, required agenda, platform and URLs", () => {
    expect(MentorSchema.safeParse(validMentor).success).toBe(true);
    expect(MentorSchema.safeParse({ ...validMentor, rating: 6 }).success).toBe(
      false,
    );
    expect(
      MentorSchema.safeParse({ ...validMentor, platform: "Skype" }).success,
    ).toBe(false);
    expect(
      MentorSchema.safeParse({ ...validMentor, platformUrl: "not-a-url" })
        .success,
    ).toBe(false);
  });

  it("validates profile preferences and nested career checklist values", () => {
    const profile = {
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      username: "ada",
      email: "ada@example.com",
      avatarUrl: "",
      phone: "+5511999999999",
      level: "Sênior",
      technologies: ["Go"],
      technologyExperiences: [{ name: "Go", years: 3 }],
    };
    const checklist = {
      id: "month-1",
      title: "Portfólio",
      month: "Outubro",
      items: [{ id: "item-1", label: "Publicar projeto", checked: false }],
    };

    expect(UserProfileSchema.safeParse(profile).success).toBe(true);
    expect(
      UserProfileSchema.safeParse({ ...profile, email: "inválido" }).success,
    ).toBe(false);
    expect(TechnologyExperienceSchema.safeParse({ name: "Go", years: 0 }).success).toBe(
      true,
    );
    expect(
      TechnologyExperienceSchema.safeParse({ name: "Go", years: -1 }).success,
    ).toBe(false);
    expect(CareerChecklistSchema.safeParse(checklist).success).toBe(true);
    expect(
      CareerChecklistSchema.safeParse({
        ...checklist,
        items: [{ ...checklist.items[0], checked: "no" }],
      }).success,
    ).toBe(false);
    expect(
      SearchPreferencesSchema.safeParse({
        keywords: ["go"],
        searchLocation: "Brasil",
        remoteOnly: false,
        jobTypes: ["Remoto"],
        emailNotifications: true,
        careerChecklist: [checklist],
      }).success,
    ).toBe(true);
  });

  it("accepts supported notification and optional message variants", () => {
    expect(
      NotificationSchema.safeParse({
        id: "n-1",
        text: "Nova vaga compatível",
        type: "match",
        date: "Hoje",
        isRead: false,
      }).success,
    ).toBe(true);
    expect(
      NotificationSchema.safeParse({
        id: 1,
        text: "Atualização",
        type: "unknown",
        date: "Hoje",
      }).success,
    ).toBe(false);
    expect(
      MessageSchema.safeParse({
        id: "m-1",
        sender: "Mentor",
        text: "Olá",
        date: "Agora",
      }).success,
    ).toBe(true);
    expect(
      MessageSchema.safeParse({
        id: 2,
        sender: "RH",
        text: "Olá",
        date: "Agora",
        origin: "recruiter",
      }).success,
    ).toBe(true);
    expect(
      MessageSchema.safeParse({
        id: 2,
        sender: "RH",
        text: "Olá",
        date: "Agora",
        origin: "unknown",
      }).success,
    ).toBe(false);
  });
});
