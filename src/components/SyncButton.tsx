"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      router.refresh();
      await new Promise((r) => setTimeout(r, 700));
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSyncing}
      onClick={handleSync}
      className="h-8 gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      aria-label="同步最新数据"
      title="刷新服务端数据，与协作者变更对齐"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span className="hidden sm:inline text-xs">同步</span>
    </Button>
  );
}
