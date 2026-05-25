"use client";

import { useEffect, useState, type MutableRefObject, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  CircleDollarSign,
  FileText,
  ReceiptText,
  Search,
  ThumbsUp,
  XCircle,
} from "lucide-react";

type ActiveTab =
  | "all"
  | "purchase_approval"
  | "payment_approval"
  | "finance_payment"
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
  onBatchReimbursement?: (rows: TData[]) => void;
  onApproveBatchPayment?: (rows: TData[]) => void;
  onFinanceConfirmPayment?: (rows: TData[]) => void;
}

const workspaceTabs: { value: ActiveTab; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "purchase_approval", label: "采购审批" },
  { value: "payment_approval", label: "打款审批" },
  { value: "finance_payment", label: "财务打款" },
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
  onBatchReimbursement,
  onApproveBatchPayment,
  onFinanceConfirmPayment,
}: DataTableProps<TData, TValue>) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>({
      estimatedCost: false,
      invoiceNo: false,
      link: false,
      remark: false,
    });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [paymentDateFilter, setPaymentDateFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      columnFilters,
      columnVisibility,
      rowSelection,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const no = String(row.getValue("requestNo") ?? "").toLowerCase();
      const applicant = String(row.getValue("applicant") ?? "").toLowerCase();
      const item = String(row.getValue("itemName") ?? "").toLowerCase();
      return no.includes(s) || applicant.includes(s) || item.includes(s);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const hasSelection = selectedRows.length > 0;
  const selectedPaymentStatuses = selectedRows.map(
    (row) => (row as { paymentStatus?: string }).paymentStatus
  );
  const isSelectedReimbursementApproval =
    hasSelection &&
    selectedPaymentStatuses.every((status) => status === "PENDING_REIMBURSEMENT");
  const isSelectedReimbursementFinance =
    hasSelection &&
    selectedPaymentStatuses.every((status) => status === "APPROVED_REIMBURSEMENT");
  const canUsePurchaseFollowupActions =
    activeTab === "pending_action" ||
    activeTab === "completed" ||
    activeTab === "all";
  const canSubmitSelectedPayment =
    hasSelection && selectedPaymentStatuses.every((status) => status === "UNPAID");
  const canSubmitSelectedReimbursement =
    hasSelection &&
    selectedRows.every((row) => {
      const item = row as { settlementType?: string | null; paymentStatus?: string };
      return (
        item.settlementType === "采购垫付" &&
        ![
          "PENDING_FUNDS",
          "APPROVING",
          "APPROVED_FUNDS",
          "PENDING_REIMBURSEMENT",
          "APPROVED_REIMBURSEMENT",
          "PAID",
          "REIMBURSED",
        ].includes(item.paymentStatus ?? "")
      );
    });
  const canShowBatchContract = canUsePurchaseFollowupActions && hasSelection;
  const filteredRows = table.getFilteredRowModel().rows;
  const totalActualCost =
    filteredRows.reduce((sum, row) => {
      const item = row.original as { actualCost?: number | null };
      const actualCost = Number(item.actualCost);
      if (!Number.isFinite(actualCost)) return sum;
      return sum + Math.round(actualCost * 100);
    }, 0) / 100;
  const hasSupplierRiskInFinance =
    activeTab === "finance_payment" &&
    filteredRows.some((row) => {
      const item = row.original as {
        paymentStatus?: string;
        paymentApprovedAt?: Date | string | null;
        updatedAt?: Date | string | null;
      };
      if (!item.paymentApprovedAt || !item.updatedAt) {
        return false;
      }
      if (
        item.paymentStatus !== "APPROVED_FUNDS" &&
        item.paymentStatus !== "APPROVED_REIMBURSEMENT"
      ) {
        return false;
      }
      return (
        new Date(item.updatedAt).getTime() -
          new Date(item.paymentApprovedAt).getTime() >
        5000
      );
    });

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
      table.getColumn("paymentStatus")?.setFilterValue("__pending_funds__");
      return;
    }

    if (nextTab === "finance_payment") {
      table.getColumn("status")?.setFilterValue(undefined);
      table.getColumn("paymentStatus")?.setFilterValue("__finance__");
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

  function handleSupplierFilter(value: string) {
    setSupplierFilter(value);
    table.getColumn("supplierName")?.setFilterValue(value);
  }

  function handleSettlementFilter(value: string | null) {
    const nextValue = value ?? "all";
    setSettlementFilter(nextValue);
    table
      .getColumn("settlementType")
      ?.setFilterValue(nextValue === "all" ? undefined : nextValue);
  }

  function handlePaymentDateFilter(value: string) {
    setPaymentDateFilter(value);
    table.getColumn("paymentApprovedAt")?.setFilterValue(value || undefined);
  }

  return (
    <div className="w-full space-y-4">
      <div className="sticky top-16 z-30 -mx-1 flex w-[calc(100%+0.5rem)] flex-col gap-3 border-b border-slate-200 bg-slate-50/95 px-1 py-2 shadow-sm backdrop-blur xl:flex-row xl:items-center xl:justify-between">
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
          {hasSelection && (
            <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
              已选 {selectedRows.length} 项
            </div>
          )}

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

          {activeTab === "payment_approval" && onApproveBatchPayment && (
            <Button
              type="button"
              variant="default"
              disabled={!hasSelection}
              onClick={() => onApproveBatchPayment(selectedRows)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {isSelectedReimbursementApproval ? "批准报销" : "批准打款"} ({selectedRows.length})
            </Button>
          )}

          {activeTab === "finance_payment" && onFinanceConfirmPayment && (
            <Button
              type="button"
              variant="default"
              disabled={!hasSelection}
              onClick={() => onFinanceConfirmPayment(selectedRows)}
            >
              <CircleDollarSign className="mr-1.5 h-4 w-4" />
              {isSelectedReimbursementFinance ? "确认报销打款" : "确认已打款"} ({selectedRows.length})
            </Button>
          )}

          {canUsePurchaseFollowupActions && (
            <>
              {onBatchContract && canShowBatchContract && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onBatchContract(selectedRows)}
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  生成合并合同 ({selectedRows.length})
                </Button>
              )}
              {activeTab === "pending_action" && onBatchPayment && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canSubmitSelectedPayment}
                  onClick={() => onBatchPayment(selectedRows)}
                  title={
                    hasSelection
                      ? "仅未进入资金流程的单据可发起对公请款"
                      : "请先勾选单据"
                  }
                >
                  <CircleDollarSign className="mr-1.5 h-4 w-4" />
                  申请合并请款 ({selectedRows.length})
                </Button>
              )}
              {onBatchReimbursement && canSubmitSelectedReimbursement && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onBatchReimbursement(selectedRows)}
                  title={
                    hasSelection
                      ? "采购垫付且未进入资金或报销流程的单据可合并报销"
                      : "请先勾选采购垫付单据"
                  }
                >
                  <ReceiptText className="mr-1.5 h-4 w-4" />
                  申请合并报销 ({selectedRows.length})
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

          <Input
            placeholder="供应商筛选"
            value={supplierFilter}
            onChange={(e) => handleSupplierFilter(e.target.value)}
            className="w-40"
          />

          <Select value={settlementFilter} onValueChange={handleSettlementFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="结算方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部结算</SelectItem>
              <SelectItem value="月结">月结</SelectItem>
              <SelectItem value="对公现结">对公现结</SelectItem>
              <SelectItem value="采购垫付">采购垫付</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={paymentDateFilter}
            onChange={(e) => handlePaymentDateFilter(e.target.value)}
            className="w-40"
            aria-label="按打款审批日期筛选"
          />

          {globalActions}
        </div>
      </div>

      {hasSupplierRiskInFinance && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          检测到部分单据在老板批准后仍发生过信息变动，请财务打款前重点复核供应商或报销账户信息。
        </div>
      )}

      <div className="w-full rounded-md border bg-white">
        <Table className="w-full">
          <TableHeader className="sticky top-[7.5rem] z-20 bg-white shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="sticky top-[7.5rem] z-20 bg-white"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left disabled:cursor-default"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: "↑",
                          desc: "↓",
                        }[header.column.getIsSorted() as string] ?? null}
                      </button>
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

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>共 {filteredRows.length} 条记录</span>
        <span className="font-semibold text-foreground">
          当前筛选合计金额：
          <span className="text-red-600">¥ {totalActualCost.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}
