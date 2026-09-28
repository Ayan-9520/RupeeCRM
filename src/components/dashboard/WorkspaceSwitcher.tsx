import { Building2, ChevronsUpDown, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function WorkspaceSwitcher() {
  const { workspaces, current, switchWorkspace, refresh, loading } = useWorkspace();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2 text-[#5c4d72]">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </Button>
    );
  }

  if (!current) {
    return (
      <Button variant="ghost" size="sm" asChild className="gap-2">
        <Link to="/dashboard/workspace">
          <Building2 className="size-3.5" /> Select workspace
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[220px] text-[#390A5D]">
          <Building2 className="size-3.5 text-[#10662A] shrink-0" />
          <span className="truncate font-semibold">{current.name}</span>
          <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">CRM workspace</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => switchWorkspace(w.id)}
            className={w.id === current.id ? "bg-[#E8F7EC]" : ""}
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{w.name}</div>
              <div className="text-[10px] text-muted-foreground uppercase">{w.plan} · {w.role}</div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link to="/dashboard/workspace" className="cursor-pointer">
            Workspace settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void refresh();
          }}
        >
          Refresh team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
