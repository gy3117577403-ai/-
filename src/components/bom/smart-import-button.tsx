"use client";

import { useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { processSmartBomImport } from "@/lib/actions/bom-import";
import * as XLSX from "xlsx";

function extractHeader(
  rows: (string | number | undefined)[][],
  maxScan = 10
): { customerName: string; productCode: string } {
  let customerName = "";
  let productCode = "";

  const customerPatterns = [/客户名称/, /客户/, /客戶/];
  const productPatterns = [/产品规格/, /产品型号/, /规格/, /机种/, /機種/];

  for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
    const row = rows[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;

      if (!customerName) {
        for (const pat of customerPatterns) {
          if (pat.test(cell)) {
            const val = String(row[c + 1] ?? "").trim();
            if (val) customerName = val;
            break;
          }
        }
      }

      if (!productCode) {
        for (const pat of productPatterns) {
          if (pat.test(cell)) {
            const val = String(row[c + 1] ?? "").trim();
            if (val) productCode = val;
            break;
          }
        }
      }
    }
  }

  return { customerName, productCode };
}

function extractConnectors(
  rows: (string | number | undefined)[][]
): { model: string; quantity: number }[] {
  let headerRowIdx = -1;
  let nameColIdx = -1;
  let modelColIdx = -1;
  let qtyColIdx = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (/^品名$/.test(cell) || /^品名\/描述$/.test(cell)) {
        headerRowIdx = r;
        nameColIdx = c;
        break;
      }
    }
    if (headerRowIdx >= 0) break;
  }

  if (headerRowIdx < 0) return [];

  const headerRow = rows[headerRowIdx];
  for (let c = 0; c < (headerRow?.length ?? 0); c++) {
    const cell = String(headerRow![c] ?? "").trim();
    if (/规格|型号/.test(cell) && modelColIdx < 0) modelColIdx = c;
    if (/数量|用量|需求/.test(cell) && qtyColIdx < 0) qtyColIdx = c;
  }

  if (modelColIdx < 0) modelColIdx = nameColIdx + 1;
  if (qtyColIdx < 0) qtyColIdx = modelColIdx + 1;

  const connectors: { model: string; quantity: number }[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const nameCell = String(row[nameColIdx] ?? "").trim();
    if (!nameCell) continue;

    if (!/连接器|連接器|connector/i.test(nameCell)) continue;

    const model = String(row[modelColIdx] ?? "").trim();
    const rawQty = row[qtyColIdx];
    const quantity = Math.max(1, Math.round(Number(rawQty) || 1));

    if (model) {
      connectors.push({ model, quantity });
    }
  }

  return connectors;
}

export function SmartImportButton() {
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
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(
          sheet,
          { header: 1 }
        );

        const { customerName, productCode } = extractHeader(rows);

        if (!customerName) {
          toast.error("解析失败：未找到「客户名称」，请检查表格头部区域");
          return;
        }
        if (!productCode) {
          toast.error("解析失败：未找到「产品规格」，请检查表格头部区域");
          return;
        }

        const connectors = extractConnectors(rows);

        if (connectors.length === 0) {
          toast.error(
            "解析失败：未找到品名含「连接器」的数据行，请检查 BOM 明细"
          );
          return;
        }

        toast.info(
          `已识别客户「${customerName}」，规格「${productCode}」，${connectors.length} 款连接器，正在写入…`
        );

        startTransition(async () => {
          try {
            const result = await processSmartBomImport({
              customerName,
              productCode,
              connectors,
            });
            if (result.matched > 0) {
              toast.success(
                `导入成功：${result.total} 款连接器已写入，自动匹配 ${result.matched} 项治具`
              );
            } else {
              toast.success(
                `导入成功：${result.total} 款连接器已写入「${productCode}」`
              );
            }
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "写入数据库失败"
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
        {isPending ? "导入中…" : "智能导入 BOM"}
      </Button>
    </>
  );
}
