"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDollarSign, FileText, Search } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableRef?: MutableRefObject<TanstackTable<TData> | null>;
  onBatchContract?: (rows: TData[]) => void;
  onBatchPayment?: (rows: TData[]) => void;
  onConfirmBatchPayment?: (rows: TData[]) => void;
  hasPendingPaymentRows?: (rows: TData[]) => boolean;
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
  onBatchContract,
  onBatchPayment,
  onConfirmBatchPayment,
  hasPendingPaymentRows,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const no = String(row.getValue("requestNo") ?? "").toLowerCase();
      const applicant = String(row.getValue("applicant") ?? "").toLowerCase();
      const item = String(row.getValue("itemName") ?? "").toLowerCase();
      return no.includes(s) || applicant.includes(s) || item.includes(s);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const hasPendingPayment =
    selectedRows.length > 0 && (hasPendingPaymentRows?.(selectedRows) ?? false);

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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {onBatchContract && (
            <Button
              type="button"
              variant="outline"
              disabled={selectedRows.length === 0}
              onClick={() => onBatchContract(selectedRows)}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              生成合并合同 ({selectedRows.length})
            </Button>
          )}
          {onBatchPayment && (
            <Button
              type="button"
              variant="outline"
              disabled={selectedRows.length === 0}
              onClick={() => onBatchPayment(selectedRows)}
            >
              <CircleDollarSign className="mr-1.5 h-4 w-4" />
              申请合并请款 ({selectedRows.length})
            </Button>
          )}
          {onConfirmBatchPayment && (
            <Button
              type="button"
              variant={hasPendingPayment ? "default" : "outline"}
              disabled={selectedRows.length === 0}
              onClick={() => onConfirmBatchPayment(selectedRows)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              批量确认打款 ({selectedRows.length})
            </Button>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="搜索单号、申请人或物资"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-md border bg-white">
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
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
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
