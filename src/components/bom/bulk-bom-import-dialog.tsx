"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import type { Customer } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { importBomWhitelistForProduct } from "@/lib/actions/bom-import";
import {
  parseWhitelistBomRows,
  type SheetRow,
} from "@/lib/bom-whitelist";

type CustomerWithProducts = Customer & {
  products: { id: string; code: string; name: string }[];
};

type ProductOption = {
  id: string;
  code: string;
  name: string;
  customerName: string;
};

type BulkBomImportDialogProps = {
  /** 客户页：列出全部产品供选择 */
  customers?: CustomerWithProducts[];
  /** 产品 BOM 页：固定归属产品，无需下拉选择 */
  fixedProduct?: { id: string; code: string };
};

export function BulkBomImportDialog({
  customers = [],
  fixedProduct,
}: BulkBomImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(fixedProduct?.id ?? "");
  const [filterByMainSpec, setFilterByMainSpec] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (fixedProduct?.id) setProductId(fixedProduct.id);
  }, [fixedProduct?.id]);

  const productOptions = useMemo<ProductOption[]>(() => {
    const list: ProductOption[] = [];
    for (const c of customers) {
      for (const p of c.products) {
        list.push({
          id: p.id,
          code: p.code,
          name: p.name,
          customerName: c.name,
        });
      }
    }
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [customers]);

  const effectiveProductId = fixedProduct?.id ?? productId;
  const effectiveProductCode = fixedProduct?.code ?? "";
  const selected = fixedProduct
    ? { id: fixedProduct.id, code: fixedProduct.code, customerName: "" }
    : productOptions.find((p) => p.id === productId);

  function parseFile(file: File) {
    const pid = String(fixedProduct?.id ?? productId ?? "").trim();
    if (!pid) {
      toast.error("请先选择要写入 BOM 的产品");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
          header: 1,
        });

        const { items, skippedRows, headerRowIndex } = parseWhitelistBomRows(
          rows,
          {
            productCode: selected?.code ?? effectiveProductCode,
            filterByMainSpec,
          }
        );

        if (headerRowIndex < 0) {
          toast.error(
            "未识别表头：请确认表格中含白名单列（如 规格/用量/位号/主件规格 等）"
          );
          return;
        }

        if (items.length === 0) {
          toast.error(
            `未解析到有效连接器行（已跳过 ${skippedRows} 行）。可尝试关闭「按主件规格过滤」或检查品名列是否含「连接器」`
          );
          return;
        }

        toast.info(
          `识别 ${items.length} 条（跳过 ${skippedRows} 行），正在写入「${selected?.code}」…`
        );

        startTransition(async () => {
          try {
            const result = await importBomWhitelistForProduct({
              productId: pid,
              rows: items,
            });
            toast.success(
              result.matched > 0
                ? `已导入 ${result.total} 条，自动匹配治具 ${result.matched} 项`
                : `已导入 ${result.total} 条 BOM 至「${result.productCode}」`
            );
            setOpen(false);
            if (!fixedProduct) setProductId("");
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
          if (fixedProduct) setProductId(fixedProduct.id);
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
              仅提取白名单列（物料编号、位号、用量、规格、主件规格等），其余列丢弃。须先选择产品；批量散表可勾选按「主件规格」过滤。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!fixedProduct && (
              <div className="space-y-1.5">
                <Label>归属产品（必填）</Label>
                {productOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无产品，请先维护客户与产品或使用智能导入创建产品。
                  </p>
                ) : (
                  <Select
                    value={productId}
                    onValueChange={(v) => setProductId(v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择产品规格" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono">{p.code}</span>
                          <span className="text-muted-foreground ml-2">
                            {p.customerName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {fixedProduct && (
              <p className="text-sm text-muted-foreground">
                将写入当前产品规格：
                <span className="ml-1 font-mono font-medium text-foreground">
                  {fixedProduct.code}
                </span>
              </p>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border border-slate-300 accent-slate-800"
                checked={filterByMainSpec}
                onChange={(e) => setFilterByMainSpec(e.target.checked)}
              />
              仅导入「主件规格」等于当前所选产品规格的行
            </label>

            <div className="space-y-1.5">
              <Label>选择文件</Label>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                disabled={!effectiveProductId || isPending}
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
