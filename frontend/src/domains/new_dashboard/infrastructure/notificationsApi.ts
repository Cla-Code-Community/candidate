import { api } from "@/shared/lib/apiClient";
import { z } from "zod";
import type { Message, MessageOrigin, Notification } from "../types";

const ApiNotificationSchema = z.object({
  id: z.string(),
  channel: z.enum(["notification", "message"]),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

const ApiNotificationsResponseSchema = z.object({
  notifications: z.array(ApiNotificationSchema),
  unreadCount: z.number(),
});

type NotificationChannel = "notification" | "message";
type ApiNotification = z.infer<typeof ApiNotificationSchema>;

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Há 1 dia";
  if (diffDays < 7) return `Há ${diffDays} dias`;

  return date.toLocaleDateString("pt-BR");
}

function notificationType(type: string): Notification["type"] {
  if (type === "high_match") return "match";
  if (type === "job_applied" || type === "job_status_changed") return "success";
  return "info";
}

function messageOrigin(type: string, title: string): MessageOrigin {
  const comparable = `${type} ${title}`.toLowerCase();
  if (
    comparable.includes("mentor") ||
    comparable.includes("mentoria")
  ) {
    return "mentor";
  }
  if (
    comparable.includes("recruiter") ||
    comparable.includes("recrutador") ||
    comparable.includes("rh")
  ) {
    return "recruiter";
  }
  return "system";
}

function toNotification(item: ApiNotification): Notification {
  return {
    id: item.id,
    text: item.message,
    type: notificationType(item.type),
    date: formatNotificationDate(item.createdAt),
  };
}

function toMessage(item: ApiNotification): Message {
  return {
    id: item.id,
    sender: item.title,
    text: item.message,
    date: formatNotificationDate(item.createdAt),
    origin: messageOrigin(item.type, item.title),
  };
}

export async function getDashboardNotificationFeed(
  channel: "notification",
): Promise<{ notifications: Notification[]; unreadCount: number }>;
export async function getDashboardNotificationFeed(
  channel: "message",
): Promise<{ messages: Message[]; unreadCount: number }>;
export async function getDashboardNotificationFeed(channel: NotificationChannel) {
  const { data } = await api.get("/notifications", {
    params: { channel, limit: 20 },
  });
  const parsed = ApiNotificationsResponseSchema.parse(data);

  if (channel === "message") {
    return {
      messages: parsed.notifications.map(toMessage),
      unreadCount: parsed.unreadCount,
    };
  }

  return {
    notifications: parsed.notifications.map(toNotification),
    unreadCount: parsed.unreadCount,
  };
}

export async function markDashboardNotificationsRead(channel: NotificationChannel) {
  await api.patch("/notifications/read-all", null, {
    params: { channel },
  });
}
