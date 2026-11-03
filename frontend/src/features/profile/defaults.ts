import type { SearchPreferences, UserProfile } from "@/features/profile/domain/user";

export const initialUser: UserProfile = {
  firstName: "Bruna",
  lastName: "Silva",
  displayName: "Bruna Silva",
  username: "brunasilva",
  email: "bruna.silva@exemplo.com",
  avatarUrl: "",
  phone: "(11) 98765-4321",
  level: "Pleno",
  technologies: ["React", "TypeScript", "Tailwind CSS", "Next.js", "Node.js"],
  technologyExperiences: [
    { name: "React", years: 5 },
    { name: "TypeScript", years: 4 },
    { name: "Tailwind CSS", years: 3 },
    { name: "Next.js", years: 3 },
    { name: "Node.js", years: 2 },
  ],
};

export const initialPreferences: SearchPreferences = {
  keywords: ["React", "Frontend", "Fullstack"],
  searchLocation: "São Paulo, SP",
  remoteOnly: false,
  jobTypes: [],
  emailNotifications: true,
  careerChecklist: [],
};
