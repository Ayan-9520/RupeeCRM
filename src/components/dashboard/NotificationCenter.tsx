import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export function NotificationCenter() {
  const { rows, loading, unread, markRead, markAllRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <Loader2 className="size-5 animate-spin mx-auto my-6" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            <ul>
              {rows.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 border-b border-border/60 text-xs ${!n.read_at ? "bg-accent/5" : ""}`}
                >
                  {n.link ? (
                    <Link to={n.link} className="block hover:text-accent" onClick={() => !n.read_at && markRead(n.id)}>
                      <p className="font-semibold">{n.title}</p>
                      {n.body && <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    </Link>
                  ) : (
                    <button type="button" className="text-left w-full" onClick={() => !n.read_at && markRead(n.id)}>
                      <p className="font-semibold">{n.title}</p>
                      {n.body && <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    </button>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
