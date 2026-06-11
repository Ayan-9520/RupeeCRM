import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  type NotificationRow,
} from "@/lib/customer-crm/notifications-service";

export function useNotifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await loadNotifications(user.id);
    setRows(res.rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setRows((p) => p.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
  };

  return { rows, loading, unread: unreadCount(rows), refresh, markRead, markAllRead };
}
