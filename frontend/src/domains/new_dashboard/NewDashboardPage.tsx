import { useAuth } from "@/domains/auth/application/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { HelpTab } from "./components/help/HelpTab";
import { HomeTab } from "./components/home/HomeTab";
import { AddJobModal } from "./components/jobs/AddJobModal";
import { JobDetailModal } from "./components/jobs/JobDetailModal";
import { JobTab } from "./components/jobs/JobTab";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { MentoringTab } from "./components/mentoring/MentoringTab";
import { ProfileTab } from "./components/profile/ProfileTab";
import { Toast } from "./components/shared/Toast";
import { jobStatuses } from "./constants";
import { useDashboardJobs } from "./hooks/useDashboardJobs";
import { useUserDashboardData } from "./hooks/useUserDashboardData";
import type {
  CareerChecklist,
  Job,
  JobStatus,
  NewJob,
  SearchPreferences,
  TechnologyExperience,
  UserProfile,
} from "./types";
import {
  type ContinentFilter,
  type CountryFilter,
} from "./utils/locationFilters";
import { parseSearchKeywords } from "./utils/searchKeywords";

function getSection(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/vagas")) return "vagas";
  if (pathname.startsWith("/mentoria")) return "mentoria";
  if (pathname.startsWith("/perfil")) return "perfil";
  if (pathname.startsWith("/ajuda")) return "ajuda";
  return "home";
}

function normalizeMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAliases(technology: string) {
  const normalized = normalizeMatchText(technology);
  const aliases = new Set([normalized]);

  if (normalized.endsWith(" js")) {
    aliases.add(normalized.replace(/\s+js$/, "js"));
  }
  if (normalized.endsWith("js") && normalized.length > 2) {
    aliases.add(normalized.replace(/js$/, " js"));
  }

  return [...aliases].filter(Boolean);
}

function textMatchesAlias(text: string, alias: string) {
  if (!alias) return false;
  if (alias.includes(" ")) return text.includes(alias);
  return ` ${text} `.includes(` ${alias} `);
}

function jobMatchText(job: Job) {
  const rawPayload = job.rawPayload ?? {};
  const rawValues = Object.values(rawPayload).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );

  return normalizeMatchText(
    [
      job.jobTitle,
      job.company,
      job.location,
      job.type,
      job.level,
      job.tags.join(" "),
      ...rawValues.map((value) => (typeof value === "string" ? value : "")),
    ].join(" "),
  );
}

function scoreJobWithTechnologies(
  job: Job,
  technologies: TechnologyExperience[],
): Job {
  if (job.rawPayload?.matchSource === "backend_profile") return job;

  const normalizedTechnologies = [
    ...new Set(
      technologies
        .filter((technology) => technology.name.trim())
        .map((technology) => ({
          name: technology.name.trim(),
          years: Math.max(0, technology.years),
        })),
    ),
  ];
  if (normalizedTechnologies.length === 0) return job;

  const text = jobMatchText(job);
  const matchedTechnologies = normalizedTechnologies.filter((technology) =>
    matchAliases(technology.name).some((alias) =>
      textMatchesAlias(text, alias),
    ),
  );

  const totalWeight = normalizedTechnologies.reduce(
    (total, technology) => total + Math.max(1, technology.years),
    0,
  );
  const matchedWeight = matchedTechnologies.reduce(
    (total, technology) => total + Math.max(1, technology.years),
    0,
  );
  const coverage = matchedWeight / totalWeight;
  const score =
    matchedTechnologies.length === 0
      ? 45
      : Math.min(
          99,
          55 +
            Math.round(coverage * 35) +
            Math.min(matchedTechnologies.length * 4, 9),
        );

  return {
    ...job,
    matchScore: score,
    rawPayload: {
      ...(job.rawPayload ?? {}),
      matchedTechnologies: matchedTechnologies.map((item) => item.name),
    },
  };
}

export default function NewDashboardPage() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [filterLevel, setFilterLevel] = useState("Todos");
  const [continentFilter, setContinentFilter] =
    useState<ContinentFilter>("Todos");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("Todos");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [toast, setToast] = useState("");
  const checklistSaveTimeout = useRef<number | null>(null);
  const showToast = useCallback((message: string) => setToast(message), []);
  const {
    userProfile,
    setUserProfile,
    searchPreferences,
    setSearchPreferences,
    isSavingProfile,
    isSavingPreferences,
    saveUserProfile,
    saveSearchPreferences,
  } = useUserDashboardData(user, { onError: showToast });
  const {
    trackedJobs,
    recommendedJobs,
    recommendedPagination,
    isRefreshingJobs,
    refreshRecommendations,
    changeRecommendationsPage,
    addTrackedJob,
    changeJobStatus,
    changeJobNotesLocally,
    saveJobNotes,
  } = useDashboardJobs(user, { onError: showToast });

  const matchedTrackedJobs = useMemo(
    () =>
      trackedJobs.map((job) =>
        scoreJobWithTechnologies(job, userProfile.technologyExperiences),
      ),
    [trackedJobs, userProfile.technologyExperiences],
  );
  const matchedRecommendedJobs = useMemo(
    () =>
      recommendedJobs.map((job) =>
        scoreJobWithTechnologies(job, userProfile.technologyExperiences),
      ),
    [recommendedJobs, userProfile.technologyExperiences],
  );
  const selectedJob =
    [...matchedTrackedJobs, ...matchedRecommendedJobs].find(
      (job) => job.id === selectedJobId,
    ) ?? null;
  const section = getSection(location.pathname);
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(
    () => () => {
      if (checklistSaveTimeout.current) {
        window.clearTimeout(checklistSaveTimeout.current);
      }
    },
    [],
  );

  const handleSaveProfile = async (profile: UserProfile) => {
    try {
      await saveUserProfile(profile);
      await refreshUser();
      showToast("Perfil atualizado com sucesso.");
    } catch {
      // O hook já notificou a falha preservando os dados editados no formulário.
    }
  };

  const handleSavePreferences = async (preferences: SearchPreferences) => {
    try {
      await saveSearchPreferences(preferences);
      showToast("Preferências de busca atualizadas.");
    } catch {
      // O hook já notificou a falha preservando as preferências editadas.
    }
  };

  const handleCareerChecklistChange = useCallback(
    (careerChecklist: CareerChecklist[]) => {
      const nextPreferences = {
        ...searchPreferences,
        careerChecklist,
      };

      setSearchPreferences(nextPreferences);

      if (checklistSaveTimeout.current) {
        window.clearTimeout(checklistSaveTimeout.current);
      }

      checklistSaveTimeout.current = window.setTimeout(() => {
        void saveSearchPreferences(nextPreferences).catch(() => {
          // O hook já publica a mensagem de erro para o usuário.
        });
      }, 600);
    },
    [saveSearchPreferences, searchPreferences, setSearchPreferences],
  );

  const handleStatusChange = async (jobId: string, status: JobStatus) => {
    try {
      const updatedJob = await changeJobStatus(jobId, status);
      if (updatedJob && selectedJobId === jobId) {
        setSelectedJobId(updatedJob.id);
      }
      showToast(`Vaga atualizada para: ${jobStatuses[status]}`);
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const handleNotesChange = (jobId: string, notes: string) => {
    changeJobNotesLocally(jobId, notes);
  };

  const handleAddJob = async (newJob: NewJob) => {
    try {
      await addTrackedJob(newJob);
      showToast("Vaga adicionada às suas oportunidades.");
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const handleCloseJob = async () => {
    const jobToPersist = selectedJob;
    setSelectedJobId(null);
    if (!jobToPersist) return;

    try {
      await saveJobNotes(jobToPersist);
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const handleRecommendationPageChange = async (page: number) => {
    try {
      await changeRecommendationsPage(page);
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const buildRecommendationSearch = () => {
    const typedKeywords = parseSearchKeywords(searchQuery);
    const filters = {
      ...(filterLevel !== "Todos" ? { level: filterLevel } : {}),
      ...(filterType !== "Todos"
        ? { type: filterType, model: filterType }
        : {}),
      ...(continentFilter !== "Todos" ? { continent: continentFilter } : {}),
      ...(countryFilter !== "Todos"
        ? { country: countryFilter, location: countryFilter }
        : {}),
    };

    return {
      keywords: typedKeywords,
      filters,
    };
  };

  const handleSearchJobs = useCallback(async () => {
    try {
      const { keywords, filters } = buildRecommendationSearch();
      await refreshRecommendations(keywords, filters, 1);
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    countryFilter,
    continentFilter,
    filterLevel,
    filterType,
    refreshRecommendations,
    searchQuery,
  ]);

  // Busca automática: dispara ao digitar (com debounce) ou ao trocar
  // qualquer filtro, sem precisar clicar em "Buscar vagas".
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (section !== "vagas") return;

    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSearchJobs();
    }, 500);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    filterType,
    filterLevel,
    continentFilter,
    countryFilter,
    section,
  ]);

  const handleRecommendationPageSizeChange = async (limit: number) => {
    try {
      const { keywords, filters } = buildRecommendationSearch();
      await refreshRecommendations(keywords, filters, 1, limit);
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const renderContent = () => {
    switch (section) {
      case "dashboard":
        return (
          <DashboardTab
            jobs={matchedTrackedJobs}
            technologies={userProfile.technologyExperiences}
            onOpenJob={(job) => setSelectedJobId(job.id)}
            onStatusChange={handleStatusChange}
            onAddJob={() => setIsAddJobOpen(true)}
          />
        );
      case "vagas":
        return (
          <JobTab
            jobs={matchedRecommendedJobs}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterType={filterType}
            setFilterType={setFilterType}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            continentFilter={continentFilter}
            setContinentFilter={setContinentFilter}
            countryFilter={countryFilter}
            setCountryFilter={setCountryFilter}
            searchPreferences={searchPreferences}
            isSearching={isRefreshingJobs}
            pagination={recommendedPagination}
            onSearchJobs={handleSearchJobs}
            onPageChange={handleRecommendationPageChange}
            onPageSizeChange={handleRecommendationPageSizeChange}
            onOpenJob={(job) => setSelectedJobId(job.id)}
            onStatusChange={handleStatusChange}
          />
        );
      case "mentoria":
        return <MentoringTab />;
      case "perfil":
        return (
          <ProfileTab
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            searchPreferences={searchPreferences}
            setSearchPreferences={setSearchPreferences}
            isSavingProfile={isSavingProfile}
            isSavingPreferences={isSavingPreferences}
            onSaveProfile={handleSaveProfile}
            onSavePreferences={handleSavePreferences}
          />
        );
      case "ajuda":
        return <HelpTab />;
      case "home":
      default:
        return (
          <HomeTab
            userProfile={userProfile}
            jobs={trackedJobs}
            careerChecklist={searchPreferences.careerChecklist}
            onCareerChecklistChange={handleCareerChecklistChange}
            onExploreJobs={() => navigate("/vagas")}
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header userProfile={userProfile} />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
          {renderContent()}
        </main>
      </div>

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={handleCloseJob}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
        />
      ) : null}

      {isAddJobOpen ? (
        <AddJobModal
          onClose={() => setIsAddJobOpen(false)}
          onAddJob={handleAddJob}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
