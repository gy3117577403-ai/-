"use client";

import { useEffect } from "react";

/** 掛載後延遲觸發瀏覽器列印（確保字體與版面渲染完成） */
export function AutoPrint() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.print();
    }, 500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
