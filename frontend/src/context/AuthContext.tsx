import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../services/api";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user ?? { id: res.data.userId, email: "" });
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function login(credentials: { email: string; password: string }) {
    const { data } = await api.post("/auth/login", credentials);
    setUser(data.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  async function refreshUser() {
    setIsLoading(true);
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user ?? { id: res.data.userId, email: "" });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
