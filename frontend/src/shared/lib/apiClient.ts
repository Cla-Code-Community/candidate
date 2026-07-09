import axios from "axios";
import { parseApiError } from "./apiError";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const payload = error.response?.data;
      return Promise.reject(
        parseApiError(payload, status, error.message || "Erro na requisição."),
      );
    }

    return Promise.reject(error);
  },
);
