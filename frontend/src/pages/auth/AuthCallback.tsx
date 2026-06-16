import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Loading from "@/Loading";

export default function AuthCallback() {
  const { user, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true;
      refreshUser();
    }
  }, [refreshUser]);

  useEffect(() => {
    if (isLoading || !hasRefreshed.current) return;

    if (user) {
      navigate("/app", { replace: true });
    } else {
      navigate("/login?error=oauth_failed", { replace: true });
    }
  }, [user, isLoading, navigate]);

  return <Loading />;
}
