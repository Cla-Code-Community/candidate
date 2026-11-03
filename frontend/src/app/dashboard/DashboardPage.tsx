import { useAuth } from "@/features/auth/application/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardTab } from "@/features/dashboard/components/DashboardTab";
import { HelpTab } from "@/features/help/components/HelpTab";
import { HomeTab } from "@/features/home/components/HomeTab";
import { AddJobModal } from "@/features/applications/components/AddJobModal";
import { JobDetailModal } from "@/features/jobs/components/JobDetailModal";
import { JobTab } from "@/features/jobs/components/JobTab";
import { Header } from "@/app/dashboard/components/Header";
import { MobileTabBar } from "@/app/dashboard/components/MobileTabBar";
import { Sidebar } from "@/app/dashboard/components/Sidebar";
import { MentoringTab } from "@/features/mentoring/components/MentoringTab";
import { ProfileTab } from "@/features/profile/components/ProfileTab";
import { Toast } from "@/shared/ui/Toast";
import { jobStatuses } from "@/features/jobs/constants";
import { useDashboardJobs } from "@/features/jobs/hooks/useDashboardJobs";
import { useUserDashboardData } from "@/features/profile/hooks/useUserDashboardData";
import {
  getJobFilterOptions,
  FALLBACK_JOB_FAMILIES,
  type JobFamilyOption,
} from "@/features/jobs/api/dashboardJobsApi";
import type { CareerChecklist, SearchPreferences, UserProfile } from "@/features/profile/domain/user";
import type { Job, JobModelFilter, JobStatus, MatchSort, NewJob } from "@/features/jobs/domain/job";
import {
  type ContinentFilter,
  type CountryFilter,
} from "@/features/jobs/domain/locationFilters";
import {
  getModelFilterFromJobTypes,
  modelFilterToApiFilter,
} from "@/features/jobs/domain/jobModelFilters";
import { parseSearchKeywords } from "@/features/jobs/domain/searchKeywords";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<JobModelFilter>("Todos");
  const [filterLevel, setFilterLevel] = useState(
    () => searchParams.get("level") || "Todos",
  );
  const [continentFilter, setContinentFilter] = useState<ContinentFilter>(
    () => (searchParams.get("continent") as ContinentFilter) || "Todos",
  );
  const [countryFilter, setCountryFilter] = useState<CountryFilter>(
    () => (searchParams.get("country") as CountryFilter) || "Todos",
  );
  const [matchSort, setMatchSort] = useState<MatchSort>(
    () => (searchParams.get("matchSort") as MatchSort) || "default",
  );
  const [stateFilter, setStateFilter] = useState(
    () => searchParams.get("state") || "",
  );
  const [cityFilter, setCityFilter] = useState(
    () => searchParams.get("city") || "",
  );
  // Captura os filtros da URL uma vez; alterações posteriores usam a busca
  // com debounce, sem disparar outra carga inicial sem a ordenação atual.
  const [initialRecommendationFilters] = useState(() => ({
    state: stateFilter.trim(),
    city: cityFilter.trim(),
    family: (searchParams.get("family") ?? "").split(",").filter(Boolean).join(","),
    matchSort,
  }));
  const [familyOptions, setFamilyOptions] = useState<JobFamilyOption[]>(
    FALLBACK_JOB_FAMILIES,
  );
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(() => {
    const param = searchParams.get("family");
    return param ? param.split(",").filter(Boolean) : [];
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [hasUserChangedJobFilters, setHasUserChangedJobFilters] =
    useState(false);
  const checklistSaveTimeout = useRef<number | null>(null);
  const hasUserSelectedModelFilter = useRef(false);
  const showToast = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    let active = true;
    getJobFilterOptions()
      .then((res) => {
        if (active && res?.families) {
          setFamilyOptions(res.families);
        }
      })
      .catch(() => {
        // Fallback already used
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedFamilies.length > 0) {
      nextParams.set("family", selectedFamilies.join(","));
      nextParams.set("familyMode", "primary");
    } else {
      nextParams.delete("family");
      nextParams.delete("familyMode");
    }
    if (filterLevel !== "Todos") {
      nextParams.set("level", filterLevel);
    } else {
      nextParams.delete("level");
    }
    if (continentFilter !== "Todos") {
      nextParams.set("continent", continentFilter);
    } else {
      nextParams.delete("continent");
    }
    if (countryFilter !== "Todos") {
      nextParams.set("country", countryFilter);
    } else {
      nextParams.delete("country");
    }
    if (matchSort !== "default") {
      nextParams.set("matchSort", matchSort);
    } else {
      nextParams.delete("matchSort");
    }
    if (stateFilter.trim()) nextParams.set("state", stateFilter.trim());
    else nextParams.delete("state");
    if (cityFilter.trim()) nextParams.set("city", cityFilter.trim());
    else nextParams.delete("city");

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    selectedFamilies,
    filterLevel,
    continentFilter,
    countryFilter,
    matchSort,
    searchParams,
    stateFilter,
    cityFilter,
    setSearchParams,
  ]);

  const {
    userProfile,
    setUserProfile,
    searchPreferences,
    setSearchPreferences,
    isLoadingUserData,
    isSavingProfile,
    isSavingPreferences,
    saveUserProfile,
    saveSearchPreferences,
  } = useUserDashboardData(user, { onError: showToast });
  const preferredModelFilter = useMemo(
    () => getModelFilterFromJobTypes(searchPreferences.jobTypes),
    [searchPreferences.jobTypes],
  );

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (!jobId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o jobId vindo da URL (navegação externa) com o estado local; execução única por navegação, não é loop de renderização.
    setSelectedJobId(jobId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("jobId");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const initialRecommendationSearch = useMemo(
    () =>
      isLoadingUserData
        ? null
        : {
          keywords: [],
          filters: {
            ...modelFilterToApiFilter(preferredModelFilter),
            ...(initialRecommendationFilters.state
              ? { state: initialRecommendationFilters.state }
              : {}),
            ...(initialRecommendationFilters.city
              ? { city: initialRecommendationFilters.city }
              : {}),
            ...(initialRecommendationFilters.matchSort !== "default"
              ? { matchSort: initialRecommendationFilters.matchSort }
              : {}),
            ...(initialRecommendationFilters.family
              ? {
                family: initialRecommendationFilters.family,
                familyMode: "primary",
              }
              : {}),
          },
        },
    [
      isLoadingUserData,
      preferredModelFilter,
      initialRecommendationFilters,
    ],
  );
  const {
    trackedJobs,
    recommendedJobs,
    recommendedPagination,
    isRefreshingJobs,
    refreshRecommendations,
    addTrackedJob,
    changeJobStatus,
    changeJobNotesLocally,
    saveJobNotes,
  } = useDashboardJobs(user, {
    onError: showToast,
    initialRecommendationSearch,
  });

  // Vagas salvas também usam apenas a compatibilidade recebida da API.
  const matchedTrackedJobs = trackedJobs;
  // A API ordena globalmente por matchScore. Preservamos a mesma métrica
  // recebida, inclusive zero e ausência, sem calcular um score após paginar.
  const matchedRecommendedJobs = recommendedJobs;
  // O filtro de modelo e aplicado pelo backend (indice do Valkey + pos-filtro).
  // Refiltrar aqui escondia vagas ja filtradas e quebrava a contagem da pagina.
  const displayedRecommendedJobs = matchedRecommendedJobs;
  const showPreferenceNotice =
    !hasUserChangedJobFilters &&
    preferredModelFilter !== "Todos" &&
    filterType === preferredModelFilter;
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
      hasUserSelectedModelFilter.current = false;
      setHasUserChangedJobFilters(false);
      setFilterType(getModelFilterFromJobTypes(preferences.jobTypes));
      showToast("Preferências de busca atualizadas.");
    } catch {
      // O hook já notificou a falha preservando as preferências editadas.
    }
  };

  const handleFilterTypeChange = useCallback((value: JobModelFilter) => {
    hasUserSelectedModelFilter.current = true;
    setHasUserChangedJobFilters(true);
    setFilterType(value);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setHasUserChangedJobFilters(true);
    setSearchQuery(value);
  }, []);

  const handleFilterLevelChange = useCallback((value: string) => {
    setHasUserChangedJobFilters(true);
    setFilterLevel(value);
  }, []);

  const handleContinentFilterChange = useCallback(
    (value: ContinentFilter) => {
      setHasUserChangedJobFilters(true);
      setContinentFilter(value);
    },
    [],
  );

  const handleCountryFilterChange = useCallback((value: CountryFilter) => {
    setHasUserChangedJobFilters(true);
    setCountryFilter(value);
  }, []);

  const handleMatchSortChange = useCallback((value: MatchSort) => {
    setHasUserChangedJobFilters(true);
    setMatchSort(value);
  }, []);
  const handleStateFilterChange = useCallback((value: string) => {
    setHasUserChangedJobFilters(true);
    setStateFilter(value);
  }, []);
  const handleCityFilterChange = useCallback((value: string) => {
    setHasUserChangedJobFilters(true);
    setCityFilter(value);
  }, []);

  const handleSelectedFamiliesChange = useCallback((value: string[]) => {
    setHasUserChangedJobFilters(true);
    setSelectedFamilies(value);
  }, []);

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
        setTimelineVersion((current) => current + 1);
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
      const { keywords, filters } = buildRecommendationSearch();
      await refreshRecommendations(
        keywords,
        filters,
        page,
        recommendedPagination.limit,
      );
    } catch {
      // A camada de dados já apresentou o erro retornado pela API.
    }
  };

  const buildRecommendationSearch = () => {
    const typedKeywords = parseSearchKeywords(searchQuery);
    const filters = {
      ...(filterLevel !== "Todos" ? { level: filterLevel } : {}),
      ...modelFilterToApiFilter(filterType),
      ...(continentFilter !== "Todos" ? { continent: continentFilter } : {}),
      ...(countryFilter !== "Todos"
        ? { country: countryFilter, location: countryFilter }
        : {}),
      ...(matchSort !== "default" ? { matchSort } : {}),
      ...(stateFilter.trim() ? { state: stateFilter.trim() } : {}),
      ...(cityFilter.trim() ? { city: cityFilter.trim() } : {}),
      ...(selectedFamilies.length > 0
        ? {
          family: selectedFamilies.join(","),
          familyMode: "primary",
        }
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
    stateFilter,
    cityFilter,
    filterType,
    matchSort,
    selectedFamilies,
    refreshRecommendations,
    searchQuery,
  ]);

  useEffect(() => {
    if (isLoadingUserData || hasUserSelectedModelFilter.current) return;

    setFilterType(preferredModelFilter);
    setHasUserChangedJobFilters(false);
  }, [isLoadingUserData, preferredModelFilter]);

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
    matchSort,
    selectedFamilies,
    section,
    stateFilter,
    cityFilter,
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
            jobs={displayedRecommendedJobs}
            searchQuery={searchQuery}
            setSearchQuery={handleSearchQueryChange}
            filterType={filterType}
            setFilterType={handleFilterTypeChange}
            filterLevel={filterLevel}
            setFilterLevel={handleFilterLevelChange}
            continentFilter={continentFilter}
            setContinentFilter={handleContinentFilterChange}
            countryFilter={countryFilter}
            setCountryFilter={handleCountryFilterChange}
            stateFilter={stateFilter}
            setStateFilter={handleStateFilterChange}
            cityFilter={cityFilter}
            setCityFilter={handleCityFilterChange}
            matchSort={matchSort}
            setMatchSort={handleMatchSortChange}
            selectedFamilies={selectedFamilies}
            setSelectedFamilies={handleSelectedFamiliesChange}
            familyOptions={familyOptions}
            searchPreferences={searchPreferences}
            showPreferenceNotice={showPreferenceNotice}
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

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {renderContent()}
        </main>
      </div>

      <MobileTabBar />

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={handleCloseJob}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          isTracked={trackedJobs.some((job) => job.id === selectedJob.id)}
          timelineVersion={timelineVersion}
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
