import axios from "axios";
import type { AxiosError } from "axios";
export function apiBaseUrl(value = import.meta.env.VITE_API_URL || ""): string {
  const base = value.replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}
export const API_BASE_URL = apiBaseUrl();
export const HEALTH_URL = `${API_BASE_URL.slice(0, -4)}/health`;
let selectedProfileId: number | null = null;
export const setApiProfileId = (id: number | null) => {
  selectedProfileId = id;
};
export const getApiProfileId = () => selectedProfileId;
export const playerConfig = (profileId = selectedProfileId) => {
  if (profileId === null) throw new Error("Select a profile first");
  return { headers: { "X-Profile-ID": String(profileId) } };
};
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    // Extract error message
    const detail = error.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join("; ")
      : detail || error.message;
    return Promise.reject(new ApiError(message, error.response?.status));
  },
);

export default api;
