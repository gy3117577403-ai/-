"use client";

import { useEffect } from "react";
import { markAsContracted } from "@/lib/actions/purchase";

export function BatchContractPrintControls({ ids }: { ids: string[] }) {
  useEffect(() => {
    let alive = true;

    void markAsContracted(ids).catch((error) => {
      if (alive) {
        console.warn(
          "[contract] failed to sync contracted status",
          error instanceof Error ? error.message : error
        );
      }
    });

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [ids]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed left-4 top-4 z-50 border border-black bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-slate-100"
    >
      下载 PDF / 打印
    </button>
  );
}
