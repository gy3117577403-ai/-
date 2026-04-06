"use client";

import { useState, useTransition } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { recalculateAllOrders } from "@/lib/actions/order";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isPending, startTransition] = useTransition();

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const orderNo = String(row.getValue("orderNo") ?? "").toLowerCase();
      const operator = String(row.getValue("operator") ?? "").toLowerCase();
      const productCode = String(
        (row.original as { product?: { code?: string } }).product?.code ?? ""
      ).toLowerCase();
      return (
        orderNo.includes(s) || operator.includes(s) || productCode.includes(s)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function handleTabChange(value: string) {
    if (value === "all") {
      table.getColumn("status")?.setFilterValue(undefined);
    } else {
      table.getColumn("status")?.setFilterValue(value);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs + 搜索 + 导出 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs defaultValue="all" onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">全部订单</TabsTrigger>
            <TabsTrigger value="READY">齐套可生产</TabsTrigger>
            <TabsTrigger value="SHORTAGE">缺料需采购</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="搜索工单号、产品或操作员…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const result = await recalculateAllOrders();
                  if (result.updated > 0) {
                    toast.success(
                      `核算完成！${result.updated} / ${result.total} 条订单状态已更新`
                    );
                  } else {
                    toast.info("核算完成！已同步最新治具库存状态，无变化");
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "核算失败");
                }
              });
            }}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "核算中…" : "重新核算齐套性"}
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info("导出功能开发中，敬请期待")}
          >
            <Download className="mr-1.5 h-4 w-4" />
            导出缺料汇总单
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-slate-400"
                >
                  暂无开工记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400">
        共 {table.getFilteredRowModel().rows.length} 条记录
      </p>
    </div>
  );
}
