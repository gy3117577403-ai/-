"use client";

import type { JigBaseInventory } from "@prisma/client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultJigInventoryExportFilename,
  exportJigInventoryToExcel,
} from "@/lib/export-excel";

type ExportExcelButtonProps = {
  /** 与当前表格一致：已按分类与搜索过滤后的行 */
  rows: JigBaseInventory[];
};

/**
 * 全厂物资总仓：导出当前视图（分类 Tab + 搜索）为 Excel。
 * 数据已在页面级一次性加载，无需再请求 Server Action。
 */
export function ExportExcelButton({ rows }: ExportExcelButtonProps) {
  function handleClick() {
    const name = defaultJigInventoryExportFilename();
    exportJigInventoryToExcel(rows, name);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={rows.length === 0}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      导出 Excel
    </Button>
  );
}
