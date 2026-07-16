import { useAuth } from "@/domains/auth/application/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
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
  JobStatus,
  NewJob,
  SearchPreferences,
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

  const selectedJob =
    [...trackedJobs, ...recommendedJobs].find(
      (job) => job.id === selectedJobId,
    ) ?? null;
  const section = getSection(location.pathname);
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  // const buildRecommendationSearch = () => {
  //   const typedKeywords = parseSearchKeywords(searchQuery);
  //   const filters = {
  //     ...(filterLevel !== "Todos" ? { level: filterLevel } : {}),
  //     ...(filterType !== "Todos" ? { type: filterType } : {}),
  //     ...(countryFilter !== "Todos" ? { location: countryFilter } : {}),
  //   };

  //   return {
  //     keywords:
  //       typedKeywords.length > 0 ? typedKeywords : searchPreferences.keywords,
  //     filters,
  //   };
  // };

  // const handleSearchJobs = async () => {
  //   try {
  //     const { keywords, filters } = buildRecommendationSearch();

  //     await refreshRecommendations(keywords, filters, 1);
  //     showToast("Vagas recomendadas atualizadas.");
  //   } catch {
  //     // A camada de dados já apresentou o erro retornado pela API.
  //   }
  // };

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
      ...(filterType !== "Todos" ? { type: filterType } : {}),
      ...(countryFilter !== "Todos" ? { location: countryFilter } : {}),
    };

    return {
      keywords:
        typedKeywords.length > 0 ? typedKeywords : searchPreferences.keywords,
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
  }, [searchQuery, filterType, filterLevel, countryFilter, section]);

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
            jobs={trackedJobs}
            technologies={userProfile.technologies}
            onOpenJob={(job) => setSelectedJobId(job.id)}
            onStatusChange={handleStatusChange}
            onAddJob={() => setIsAddJobOpen(true)}
          />
        );
      case "vagas":
        return (
          <JobTab
            jobs={recommendedJobs}
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
