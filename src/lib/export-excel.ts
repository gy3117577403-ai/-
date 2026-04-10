import type { JigBaseInventory } from "@prisma/client";
import * as XLSX from "xlsx";
import { shanghaiFileTimestamp } from "@/lib/dayjs-shanghai";

/** 与表格搜索一致：当前分类 + 模糊匹配型号/对插/备注 */
export function filterJigInventoryRows(
  rows: JigBaseInventory[],
  category: "JIG" | "OTHER",
  search: string
): JigBaseInventory[] {
  let r = rows.filter((d) => d.category === category);
  const s = search.trim().toLowerCase();
  if (!s) return r;
  return r.filter((d) => {
    const modelCode = String(d.modelCode ?? "").toLowerCase();
    const matingModel = String(d.matingModel ?? "").toLowerCase();
    const remarks = String(d.remarks ?? "").toLowerCase();
    return (
      modelCode.includes(s) ||
      matingModel.includes(s) ||
      remarks.includes(s)
    );
  });
}

export type JigInventoryZhRow = {
  物资型号: string;
  对插型号: string;
  数量: number;
  备注: string;
};

function mapToChineseRows(rows: JigBaseInventory[]): JigInventoryZhRow[] {
  return rows.map((row) => ({
    物资型号: row.modelCode,
    对插型号: row.matingModel?.trim() ? row.matingModel : "",
    数量: row.quantity,
    备注: row.remarks?.trim() ? row.remarks : "",
  }));
}

/**
 * 将总仓数据导出为 Excel（表头为中文，不含英文字段名）
 */
export function exportJigInventoryToExcel(
  rows: JigBaseInventory[],
  filename: string
): void {
  const sheetData = mapToChineseRows(rows);
  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 36 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "库存");
  XLSX.writeFile(wb, filename);
}

/** 默认文件名：治具总仓库存_上海时间.xlsx */
export function defaultJigInventoryExportFilename(): string {
  return `治具总仓库存_${shanghaiFileTimestamp()}.xlsx`;
}
