"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { batchImportBOM } from "@/lib/actions/bom-import";
import {
  aggregateBatchTable3Bom,
  pickGroupForFixedProduct,
  type Table3SheetRow,
} from "@/lib/bom-batch-table3";

export type BulkBomFixedProduct = {
  id: string;
  code: string;
  customerName: string;
};

type BulkBomImportDialogProps = {
  /** 产品 BOM 页：仅导入与当前客户 + 主件规格一致的一组 */
  fixedProduct?: BulkBomFixedProduct;
};

export function BulkBomImportDialog({
  fixedProduct,
}: BulkBomImportDialogProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Table3SheetRow>(sheet, {
          header: 1,
        });

        let payload;
        try {
          payload = aggregateBatchTable3Bom(rows);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "解析失败");
          return;
        }

        if (payload.length === 0) {
          toast.error(
            '未解析到数据：请确认子件品名列（第 7 列）为「连接器」，且客户、主件规格、型号、用量列齐全'
          );
          return;
        }

        const toSubmit = fixedProduct
          ? (() => {
              const one = pickGroupForFixedProduct(
                payload,
                fixedProduct.customerName,
                fixedProduct.code
              );
              if (!one) {
                toast.error(
                  `文件中未找到与当前客户「${fixedProduct.customerName}」、规格「${fixedProduct.code}」匹配的连接器分组`
                );
                return null;
              }
              return [one];
            })()
          : payload;

        if (!toSubmit) return;

        const summary = fixedProduct
          ? `当前产品 ${toSubmit[0].connectors.length} 条连接器`
          : `${toSubmit.length} 个主件规格分组`;

        toast.info(`已聚合 ${summary}，正在写入…`);

        startTransition(async () => {
          try {
            const result = await batchImportBOM(toSubmit);
            toast.success(
              result.matched > 0
                ? `已导入 ${result.groups} 组、共 ${result.totalConnectors} 条连接器，自动匹配治具 ${result.matched} 项`
                : `已导入 ${result.groups} 组、共 ${result.totalConnectors} 条连接器`
            );
            setOpen(false);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "导入失败");
          }
        });
      } catch {
        toast.error("文件解析失败，请使用 .xlsx / .xls / .csv");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        表三 BOM 白名单导入
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>表三 BOM 白名单导入</DialogTitle>
            <DialogDescription>
              按固定列解析：第 1 列客户、第 4 列主件规格、第 7 列子件品名须为「连接器」、第 8
              列型号、第 10 列用量；按客户与主件规格双层隔离聚合后写入，全量覆盖各产品下旧
              BOM。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {fixedProduct ? (
              <p className="text-sm text-muted-foreground">
                仅写入与当前一致的分组：客户「{fixedProduct.customerName}」· 规格{" "}
                <span className="font-mono font-medium text-foreground">
                  {fixedProduct.code}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                将按表中所有「客户 + 主件规格」分组分别写入；同一主件规格下旧连接器明细会被清空后替换。
              </p>
            )}

            <div className="space-y-1.5">
              <Label>选择文件</Label>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                disabled={isPending}
                className="block w-full text-sm text-slate-600"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) parseFile(f);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
