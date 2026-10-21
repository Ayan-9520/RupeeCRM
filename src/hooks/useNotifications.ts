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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await loadNotifications(user.id);
    setError(res.error ?? null);
    if (!res.error) setRows(res.rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const markRead = async (id: string) => {
    const res = await markNotificationRead(id);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)));
  };

  const markAllRead = async () => {
    if (!user) return;
    const res = await markAllNotificationsRead(user.id);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((p) => p.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
  };

  return { rows, loading, error, unread: unreadCount(rows), refresh, markRead, markAllRead };
}
