"use client";

import { useEffect, useState, type MutableRefObject, type ReactNode } from "react";
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
import {
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Search,
  ThumbsUp,
  XCircle,
} from "lucide-react";

type ActiveTab =
  | "all"
  | "purchase_approval"
  | "payment_approval"
  | "pending_action"
  | "completed";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableRef?: MutableRefObject<TanstackTable<TData> | null>;
  globalActions?: ReactNode;
  onBatchApprove?: (rows: TData[]) => void;
  onBatchReject?: (rows: TData[]) => void;
  onBatchContract?: (rows: TData[]) => void;
  onBatchPayment?: (rows: TData[]) => void;
  onConfirmBatchPayment?: (rows: TData[]) => void;
}

const workspaceTabs: { value: ActiveTab; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "purchase_approval", label: "采购审批" },
  { value: "payment_approval", label: "打款审批" },
  { value: "pending_action", label: "待采购/入库" },
  { value: "completed", label: "已完成" },
];

export function DataTable<TData, TValue>({
  columns,
  data,
  tableRef,
  globalActions,
  onBatchApprove,
  onBatchReject,
  onBatchContract,
  onBatchPayment,
  onConfirmBatchPayment,
}: DataTableProps<TData, TValue>) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
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
  const hasSelection = selectedRows.length > 0;

  useEffect(() => {
    if (!tableRef) return;
    tableRef.current = table;
    return () => {
      tableRef.current = null;
    };
  }, [table, tableRef]);

  function applyWorkspaceFilter(nextTab: ActiveTab) {
    table.resetRowSelection();

    if (nextTab === "all") {
      table.getColumn("status")?.setFilterValue(undefined);
      table.getColumn("paymentStatus")?.setFilterValue(undefined);
      return;
    }

    if (nextTab === "purchase_approval") {
      table.getColumn("status")?.setFilterValue("PENDING");
      table.getColumn("paymentStatus")?.setFilterValue(undefined);
      return;
    }

    if (nextTab === "payment_approval") {
      table.getColumn("status")?.setFilterValue(undefined);
      table.getColumn("paymentStatus")?.setFilterValue("APPROVING");
      return;
    }

    if (nextTab === "pending_action") {
      table.getColumn("status")?.setFilterValue("__active__");
      table.getColumn("paymentStatus")?.setFilterValue(undefined);
      return;
    }

    table.getColumn("status")?.setFilterValue("__done__");
    table.getColumn("paymentStatus")?.setFilterValue(undefined);
  }

  function handleTabChange(value: string) {
    const nextTab = value as ActiveTab;
    setActiveTab(nextTab);
    applyWorkspaceFilter(nextTab);
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            {workspaceTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          {activeTab === "purchase_approval" && (
            <>
              {onBatchApprove && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasSelection}
                  onClick={() => onBatchApprove(selectedRows)}
                >
                  <ThumbsUp className="mr-1.5 h-4 w-4" />
                  批量同意 ({selectedRows.length})
                </Button>
              )}
              {onBatchReject && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasSelection}
                  onClick={() => onBatchReject(selectedRows)}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  批量驳回 ({selectedRows.length})
                </Button>
              )}
            </>
          )}

          {activeTab === "payment_approval" && onConfirmBatchPayment && (
            <Button
              type="button"
              variant="default"
              disabled={!hasSelection}
              onClick={() => onConfirmBatchPayment(selectedRows)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              批量确认打款 ({selectedRows.length})
            </Button>
          )}

          {activeTab === "pending_action" && (
            <>
              {onBatchContract && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasSelection}
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
                  disabled={!hasSelection}
                  onClick={() => onBatchPayment(selectedRows)}
                >
                  <CircleDollarSign className="mr-1.5 h-4 w-4" />
                  申请合并请款 ({selectedRows.length})
                </Button>
              )}
            </>
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

          {globalActions}
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
