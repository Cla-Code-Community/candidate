import axios from "axios";

export const api = axios.create({
  baseURL:
    (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001") + "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
