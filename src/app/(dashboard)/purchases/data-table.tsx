"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
  type Table as TanstackTable,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Settings2 } from "lucide-react";

const columnLabels: Record<string, string> = {
  requestNo: "单号",
  applicant: "申请人",
  itemName: "物资型号",
  quantity: "数量",
  estimatedCost: "预估金额",
  actualCost: "实际金额",
  invoiceNo: "发票号",
  link: "链接",
  status: "状态",
  paymentStatus: "付款状态",
  remark: "备注",
  createdAt: "申请时间",
};

const DEFAULT_HIDDEN: VisibilityState = {
  estimatedCost: false,
  actualCost: false,
  invoiceNo: false,
  paymentStatus: false,
  remark: false,
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableRef?: MutableRefObject<TanstackTable<TData> | null>;
}

const tabFilters: { value: string; label: string; filter: string }[] = [
  { value: "all", label: "全部", filter: "" },
  { value: "PENDING", label: "待审批", filter: "PENDING" },
  { value: "active", label: "待采购/入库", filter: "__active__" },
  { value: "done", label: "已完成", filter: "__done__" },
];

export function DataTable<TData, TValue>({
  columns,
  data,
  tableRef,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => ({ ...DEFAULT_HIDDEN })
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const no = String(row.getValue("requestNo") ?? "").toLowerCase();
      const applicant = String(row.getValue("applicant") ?? "").toLowerCase();
      const item = String(row.getValue("itemName") ?? "").toLowerCase();
      return no.includes(s) || applicant.includes(s) || item.includes(s);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  useEffect(() => {
    if (!tableRef) return;
    tableRef.current = table;
    return () => {
      tableRef.current = null;
    };
  }, [table, tableRef]);

  function handleTabChange(value: string) {
    const tab = tabFilters.find((t) => t.value === value);
    if (!tab || !tab.filter) {
      table.getColumn("status")?.setFilterValue(undefined);
    } else {
      table.getColumn("status")?.setFilterValue(tab.filter);
    }
  }

  const toggleableColumns = table
    .getAllColumns()
    .filter(
      (col) =>
        typeof col.getCanHide === "function" &&
        col.getCanHide() &&
        typeof col.id === "string" &&
        col.id.length > 0
    );

  return (
    <div className="w-full space-y-4">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs defaultValue="all" onValueChange={handleTabChange}>
          <TabsList>
            {tabFilters.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="搜索单号、申请人或物资…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                />
              }
            >
              <Settings2 className="h-4 w-4" />
              显示列
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>显示列</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleableColumns.map((column) => {
                const label = columnLabels[column.id] || column.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border bg-white">
        <Table className="w-full">
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
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-slate-400"
                >
                  暂无请购记录
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
