import { createContext, useContext, useState, type ReactNode } from "react";

interface ToastContextValue {
  toast: string;
  triggerToast: (message: string) => void;
  clearToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");

  const triggerToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  return (
    <ToastContext.Provider
      value={{ toast, triggerToast, clearToast: () => setToast("") }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within ToastProvider");
  }
  return context;
}

