import { useCallback, useEffect, useState } from "react";
import { isApiError } from "@/shared/lib/apiError";
import type { User } from "@/domains/auth/domain/auth.types";
import { initialPreferences, initialUser } from "../constants";
import type { SearchPreferences, UserProfile } from "../types";
import {
  createUserPreferences,
  getUserPreferences,
  getUserProfile,
  updateUserPreferences,
  updateUserProfile,
} from "../infrastructure/userDashboardApi";

function profileFromAuthUser(user: User | null): UserProfile {
  const displayName =
    user?.displayName?.trim() ||
    user?.name?.trim() ||
    user?.email?.split("@")[0] ||
    initialUser.displayName;

  return {
    ...initialUser,
    displayName,
    email: user?.email || initialUser.email,
    avatarUrl: user?.avatarUrl || initialUser.avatarUrl,
    username:
      displayName.trim().replace(/\s+/g, "").toLowerCase() ||
      initialUser.username,
  };
}

interface UseUserDashboardDataOptions {
  onError?: (message: string) => void;
}

export function useUserDashboardData(
  user: User | null,
  { onError }: UseUserDashboardDataOptions = {},
) {
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    profileFromAuthUser(user),
  );
  const [searchPreferences, setSearchPreferences] =
    useState<SearchPreferences>(initialPreferences);
  const [isLoadingUserData, setIsLoadingUserData] = useState(Boolean(user));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [userDataError, setUserDataError] = useState("");
  const [hasStoredPreferences, setHasStoredPreferences] = useState(true);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadUserData() {
      setIsLoadingUserData(true);
      setUserDataError("");

      const [profileResult, preferencesResult] = await Promise.allSettled([
        getUserProfile(),
        getUserPreferences(),
      ]);

      if (!isMounted) return;

      const errors: string[] = [];

      if (profileResult.status === "fulfilled") {
        setUserProfile(profileResult.value);
      } else {
        setUserProfile(profileFromAuthUser(user));
        errors.push("Não foi possível carregar seu perfil completo.");
      }

      if (preferencesResult.status === "fulfilled") {
        setSearchPreferences(preferencesResult.value);
        setHasStoredPreferences(true);
      } else if (
        isApiError(preferencesResult.reason) &&
        preferencesResult.reason.status === 404
      ) {
        setSearchPreferences(initialPreferences);
        setHasStoredPreferences(false);
      } else {
        setSearchPreferences(initialPreferences);
        errors.push(
          "Não foi possível carregar suas preferências. Preferências temporárias foram aplicadas.",
        );
      }

      if (errors.length > 0) {
        const message = errors.join(" ");
        setUserDataError(message);
        onError?.(message);
      }

      setIsLoadingUserData(false);
    }

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [onError, user]);

  const saveUserProfile = useCallback(async (profile: UserProfile) => {
    setIsSavingProfile(true);
    setUserDataError("");

    try {
      const updated = await updateUserProfile(profile);
      setUserProfile(updated);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar perfil.";
      setUserDataError(message);
      onError?.(message);
      throw error;
    } finally {
      setIsSavingProfile(false);
    }
  }, [onError]);

  const saveSearchPreferences = useCallback(
    async (preferences: SearchPreferences) => {
      setIsSavingPreferences(true);
      setUserDataError("");

      try {
        const updated = hasStoredPreferences
          ? await updateUserPreferences(preferences)
          : await createUserPreferences(preferences);
        setSearchPreferences(updated);
        setHasStoredPreferences(true);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao salvar preferências.";
        setUserDataError(message);
        onError?.(message);
        throw error;
      } finally {
        setIsSavingPreferences(false);
      }
    },
    [hasStoredPreferences, onError],
  );

  return {
    userProfile,
    setUserProfile,
    searchPreferences,
    setSearchPreferences,
    isLoadingUserData,
    isSavingProfile,
    isSavingPreferences,
    userDataError,
    saveUserProfile,
    saveSearchPreferences,
  };
}
