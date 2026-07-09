import { createContext } from "react";

export type NotificationTone = "success" | "warning" | "error" | "info";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  description?: string;
}

export type NotifyInput = Omit<AppNotification, "id">;

export interface NotificationContextValue {
  notify: (notification: NotifyInput) => void;
  dismiss: (id: string) => void;
}

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
