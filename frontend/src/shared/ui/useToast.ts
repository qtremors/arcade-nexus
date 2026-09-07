import { createContext, useContext } from "react";
export type ToastType = "success" | "error" | "info";
export const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void;
} | null>(null);
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("ToastProvider is required");
  return context;
}
