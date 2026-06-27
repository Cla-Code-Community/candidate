export interface User {
  id: string;
  email: string;
  name?: string;
  displayName?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  cpf?: string;
  technologies?: string[];
  level?: string;
  role?: "user" | "admin";
}
