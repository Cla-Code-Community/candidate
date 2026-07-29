export const DASHBOARD_NOTIFICATIONS_REFRESH_EVENT =
  "dashboard:notifications-refresh";

export type DashboardNotificationsRefreshDetail = {
  channel?: "notification" | "message";
  incrementUnread?: boolean;
  item?: {
    id: string;
    text: string;
    type: "info" | "success" | "match";
    date: string;
    sender?: string;
    origin?: "recruiter" | "mentor" | "system";
  };
};

export function requestDashboardNotificationsRefresh(
  detail: DashboardNotificationsRefreshDetail = {},
) {
  window.dispatchEvent(
    new CustomEvent<DashboardNotificationsRefreshDetail>(
      DASHBOARD_NOTIFICATIONS_REFRESH_EVENT,
      { detail },
    ),
  );
}
