"use client";

import { useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { batchImportJigs } from "@/lib/actions/jig-inventory";
import * as XLSX from "xlsx";

interface ParsedRow {
  modelCode: string;
  matingModel?: string;
  quantity: number;
  remarks?: string;
}

function findColIndex(
  headers: string[],
  patterns: RegExp[]
): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? "").trim();
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

function parseSheet(rows: (string | number | undefined)[][]): ParsedRow[] {
  if (rows.length < 2) return [];

  let headerIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row) continue;
    const joined = row.map((c) => String(c ?? "").trim()).join("");
    if (/治具型号/.test(joined)) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;

  const headers = (rows[headerIdx] ?? []).map((c) => String(c ?? ""));

  const modelIdx = findColIndex(headers, [/治具型号/, /型号/, /model/i]);
  const matingIdx = findColIndex(headers, [/对插型号/, /对插/, /mating/i]);
  const qtyIdx = findColIndex(headers, [/数量/, /数/, /qty/i, /quantity/i]);
  const remarkIdx = findColIndex(headers, [/备注/, /说明/, /remark/i]);

  if (modelIdx < 0) return [];

  const result: ParsedRow[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const modelCode = String(row[modelIdx] ?? "").trim();
    if (!modelCode) continue;

    const matingModel =
      matingIdx >= 0 ? String(row[matingIdx] ?? "").trim() || undefined : undefined;
    const rawQty = qtyIdx >= 0 ? row[qtyIdx] : 0;
    const quantity = Math.max(0, Math.round(Number(rawQty) || 0));
    const remarks =
      remarkIdx >= 0 ? String(row[remarkIdx] ?? "").trim() || undefined : undefined;

    result.push({ modelCode, matingModel, quantity, remarks });
  }

  return result;
}

export function ImportExcelButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(
          sheet,
          { header: 1 }
        );

        const items = parseSheet(rows);

        if (items.length === 0) {
          toast.error(
            "解析失败：未找到有效数据，请确认表格包含「治具型号」列"
          );
          return;
        }

        toast.info(`已解析 ${items.length} 条记录，正在写入…`);

        startTransition(async () => {
          try {
            await batchImportJigs(items);
            toast.success(
              `导入成功：${items.length} 条治具库存已写入（已有型号数量累加）`
            );
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "批量导入失败"
            );
          }
        });
      } catch {
        toast.error("文件解析失败，请确认是有效的 Excel 或 CSV 文件");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="outline" onClick={handleClick} disabled={isPending}>
        <Upload className="mr-1.5 h-4 w-4" />
        {isPending ? "导入中…" : "Excel 导入"}
      </Button>
    </>
  );
}
