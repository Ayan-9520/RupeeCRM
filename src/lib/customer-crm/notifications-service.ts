import { request } from "@/lib/python-api";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export async function loadNotifications(_userId: string, _limit = 30): Promise<{ rows: NotificationRow[]; error?: string }> {
  try {
    const data = await request<{ rows: NotificationRow[] }>("/api/notifications");
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load notifications") };
  }
}

export async function createNotification(
  _userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    await request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ type, title, body: body ?? null, link: link ?? null }),
    });
    return { error: null as string | null };
  } catch (err) {
    return { error: apiError(err, "Could not save the notification") };
  }
}

export async function markNotificationRead(id: string) {
  try {
    await request(`/api/notifications/${id}/read`, { method: "POST" });
    return { error: null as string | null };
  } catch (err) {
    return { error: apiError(err, "Could not mark the notification read") };
  }
}

export async function markAllNotificationsRead(_userId: string) {
  try {
    await request("/api/notifications/read-all", { method: "POST" });
    return { error: null as string | null };
  } catch (err) {
    return { error: apiError(err, "Could not mark notifications read") };
  }
}

export function unreadCount(rows: NotificationRow[]): number {
  return rows.filter((r) => !r.read_at).length;
}
