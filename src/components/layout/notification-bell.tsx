"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPendingTasksCountAction } from "@/lib/actions/purchase";

const POLL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    getPendingTasksCountAction()
      .then(setCount)
      .catch(() => setCount(0));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative shrink-0 text-slate-600 hover:text-slate-900"
            aria-label="待办通知"
          />
        }
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden
          />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>采购待办</DropdownMenuLabel>
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {count > 0 ? (
            <span>
              当前有 <span className="font-semibold text-foreground">{count}</span>{" "}
              条待处理
            </span>
          ) : (
            <span>暂无待办</span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/purchases")}>
          前往采购审批
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
