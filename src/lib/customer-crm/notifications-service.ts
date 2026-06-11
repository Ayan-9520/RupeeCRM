import { supabase } from "@/integrations/supabase/client";

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

export async function loadNotifications(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [] as NotificationRow[], error: error.message };
  return { rows: (data ?? []) as NotificationRow[] };
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
) {
  const { error } = await supabase.rpc("notify", {
    _user_id: userId,
    _type: type,
    _title: title,
    _body: body ?? null,
    _link: link ?? null,
    _metadata: {},
  });
  if (error) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: type as never,
      title,
      body: body ?? null,
      link: link ?? null,
    });
  }
}

export async function markNotificationRead(id: string) {
  return supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsRead(userId: string) {
  return supabase.rpc("mark_all_notifications_read");
}

export function unreadCount(rows: NotificationRow[]): number {
  return rows.filter((r) => !r.read_at).length;
}
