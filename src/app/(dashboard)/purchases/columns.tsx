"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  PaymentStatus,
  PurchaseRequest,
  PurchaseStatus,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  ExternalLink,
  FileText,
  MoreHorizontal,
  PackageCheck,
  PencilLine,
  Receipt,
  ShoppingCart,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatInShanghai } from "@/lib/dayjs-shanghai";
import { updatePurchaseSettlementTypeAction } from "@/lib/actions/purchase";

const statusConfig: Record<
  PurchaseStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "待审批", className: "bg-amber-500/90 text-white" },
  APPROVED: { label: "已批准", className: "bg-blue-500/90 text-white" },
  REJECTED: { label: "已驳回", className: "bg-slate-400 text-white" },
  ORDERED: { label: "已采购", className: "bg-indigo-500/90 text-white" },
  RECEIVED: { label: "已入库", className: "bg-emerald-500/90 text-white" },
  CANCELLED: { label: "已撤回", className: "bg-slate-500/90 text-white" },
};

const paymentBadge: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  UNPAID: { label: "未付款", className: "bg-slate-500/80 text-white" },
  APPROVING: { label: "待打款审批", className: "bg-orange-500/90 text-white" },
  PENDING_FUNDS: { label: "待打款审批", className: "bg-orange-500/90 text-white" },
  APPROVED_FUNDS: { label: "待财务打款", className: "bg-cyan-600/90 text-white" },
  PENDING_REIMBURSEMENT: { label: "待报销审批", className: "bg-amber-500/90 text-white" },
  APPROVED_REIMBURSEMENT: { label: "待财务报销", className: "bg-blue-600/90 text-white" },
  PAID: { label: "已付款", className: "bg-emerald-600/90 text-white" },
  REIMBURSED: { label: "已报销完成", className: "bg-emerald-600/90 text-white" },
};

const LARGE_AMOUNT = 500;
const SETTLEMENT_TYPE_OPTIONS = ["采购垫付", "对公现结", "月结"] as const;
const ACTIVE_PAYMENT_FLOW_STATUSES: PaymentStatus[] = [
  "APPROVING",
  "PENDING_FUNDS",
  "APPROVED_FUNDS",
  "PENDING_REIMBURSEMENT",
  "APPROVED_REIMBURSEMENT",
];

function compactRequestNo(value: string) {
  return value.length > 6 ? `...${value.slice(-6)}` : value;
}

function isFinancialSettled(row: Pick<PurchaseRequest, "paymentStatus">) {
  return row.paymentStatus === "PAID" || row.paymentStatus === "REIMBURSED";
}

function hasInvoice(row: Pick<PurchaseRequest, "invoiceNo">) {
  return Boolean(row.invoiceNo?.trim());
}

function isPurchaseClosed(row: PurchaseRequest) {
  return row.status === "RECEIVED" && isFinancialSettled(row) && hasInvoice(row);
}

function needsInvoice(row: PurchaseRequest) {
  return row.status === "RECEIVED" && isFinancialSettled(row) && !hasInvoice(row);
}

function hasSupplierChangeAfterApproval(row: PurchaseRequest) {
  if (row.paymentStatus !== "APPROVED_FUNDS" || !row.paymentApprovedAt) {
    return false;
  }
  return (
    new Date(row.updatedAt).getTime() -
      new Date(row.paymentApprovedAt).getTime() >
    5000
  );
}

function RequestNoCell({
  requestNo,
  expandAll,
  collapseSignal,
}: {
  requestNo: string;
  expandAll: boolean;
  collapseSignal: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = expandAll || expanded;

  useEffect(() => {
    if (!expandAll) {
      queueMicrotask(() => setExpanded(false));
    }
  }, [collapseSignal, expandAll]);

  return (
    <div className="flex w-[96px] items-start gap-1 font-mono text-xs text-muted-foreground">
      <span
        className={
          isExpanded
            ? "max-w-[160px] break-all whitespace-normal leading-snug"
            : "w-[64px] truncate"
        }
        title={requestNo}
      >
        {isExpanded ? requestNo : compactRequestNo(requestNo)}
      </span>
      <button
        type="button"
        className="mt-[-2px] rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        title={isExpanded ? "收起单号" : "展开完整单号"}
        aria-label={isExpanded ? "收起单号" : "展开完整单号"}
        onClick={(event) => {
          event.stopPropagation();
          if (expandAll) return;
          setExpanded((value) => !value);
        }}
      >
        {isExpanded ? (
          <ChevronsLeft className="h-3.5 w-3.5" />
        ) : (
          <ChevronsRight className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function SettlementTypeCell({
  row,
  canEdit,
}: {
  row: PurchaseRequest;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentValue = row.settlementType?.trim() || "";
  const [value, setValue] = useState(currentValue);

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  if (!canEdit) {
    return value ? (
      <span className="block w-[80px] text-center text-sm">{value}</span>
    ) : (
      <span className="block w-[80px] text-center text-xs text-slate-400">-</span>
    );
  }

  function handleChange(nextValue: string | null) {
    if (!nextValue) return;
    if (nextValue === value) return;
    if (
      nextValue === "采购垫付" &&
      value !== "采购垫付" &&
      !confirm("切换为采购垫付后将清空供应商名称、账号、开户行，确定继续吗？")
    ) {
      return;
    }
    const previousValue = value;
    setValue(nextValue);
    startTransition(() => {
      void (async () => {
        try {
          await updatePurchaseSettlementTypeAction(row.id, nextValue);
          toast.success(`结算方式已变更为 ${nextValue}`);
          router.refresh();
        } catch (error) {
          setValue(previousValue);
          toast.error(error instanceof Error ? error.message : "结算方式更新失败");
        }
      })();
    });
  }

  return (
    <div
      className="flex w-[80px] justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <Select
        value={value || undefined}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger
          size="sm"
          className="h-8 w-full border-0 bg-transparent shadow-none hover:bg-accent focus:ring-0 px-2 flex justify-between items-center text-sm focus-visible:border-transparent focus-visible:ring-0"
          title="修改结算方式"
        >
          {value ? (
            <SelectValue />
          ) : (
            <span className="border-b border-dashed border-gray-300 text-xs text-muted-foreground">
              点击设置
            </span>
          )}
        </SelectTrigger>
        <SelectContent align="center" className="min-w-28">
          {SETTLEMENT_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getColumns(options: {
  role: string;
  sessionName: string;
  sessionUserId: string;
  onApprove: (row: PurchaseRequest) => void;
  onReject: (row: PurchaseRequest) => void;
  onMarkOrdered: (row: PurchaseRequest) => void;
  onMarkReceived: (row: PurchaseRequest) => void;
  onDelete: (row: PurchaseRequest) => void;
  onWithdraw: (row: PurchaseRequest) => void;
  onMarkAsPaid: (row: PurchaseRequest) => void;
  onEditInvoice: (row: PurchaseRequest) => void;
  onPrintContract: (row: PurchaseRequest) => void;
  onAdminEditCost: (row: PurchaseRequest) => void;
  onEditSupplier: (row: PurchaseRequest) => void;
  requestNoExpandedAll?: boolean;
  requestNoCollapseSignal?: number;
}): ColumnDef<PurchaseRequest>[] {
  const { role, sessionName, sessionUserId } = options;
  const requestNoExpandedAll = options.requestNoExpandedAll ?? false;
  const requestNoCollapseSignal = options.requestNoCollapseSignal ?? 0;

  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex w-[40px] justify-center">
          <Checkbox
            aria-label="选择全部"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(Boolean(checked))
            }
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex w-[40px] justify-center">
          <Checkbox
            aria-label="选择行"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "requestNo",
      header: () => (
        <span className="block w-[96px] text-muted-foreground">单号</span>
      ),
      cell: ({ row }) => {
        const requestNo = row.getValue("requestNo") as string;
        return (
          <RequestNoCell
            requestNo={requestNo}
            expandAll={requestNoExpandedAll}
            collapseSignal={requestNoCollapseSignal}
          />
        );
      },
    },
    {
      accessorKey: "applicant",
      header: () => <span className="block w-[60px]">申请人</span>,
      cell: ({ row }) => (
        <span className="block w-[60px] text-sm">
          {row.getValue("applicant") as string}
        </span>
      ),
    },
    {
      accessorKey: "itemName",
      header: () => (
        <span className="block min-w-[200px] max-w-[350px] break-words">
          物资名称
        </span>
      ),
      cell: ({ row }) => {
        const itemName = row.getValue("itemName") as string;
        const url = row.original.link?.trim();
        if (url) {
          return (
            <div
              className="min-w-[200px] max-w-[350px] break-words whitespace-normal font-mono text-sm font-medium"
              title={itemName}
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1 leading-snug text-blue-600 hover:underline"
              >
                <span className="mt-0.5">{itemName}</span>
                <ExternalLink className="mt-1 h-3.5 w-3.5 flex-shrink-0" />
              </a>
            </div>
          );
        }
        return (
          <div
            className="min-w-[200px] max-w-[350px] break-words whitespace-normal font-mono text-sm font-medium"
            title={itemName}
          >
            <span className="leading-snug">{itemName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: () => (
        <span className="block w-[80px] text-right tabular-nums">数量</span>
      ),
      cell: ({ row }) => (
        <span className="block w-[80px] text-right tabular-nums font-medium">
          {(row.getValue("quantity") as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "estimatedCost",
      header: () => (
        <span className="block w-[80px] text-right tabular-nums">预估</span>
      ),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="block w-[80px] text-right tabular-nums">
          ￥{(row.getValue("estimatedCost") as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "actualCost",
      header: () => (
        <span className="block w-[80px] text-right tabular-nums">实际</span>
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const req = row.original;
        const value = row.getValue("actualCost") as number | null;
        const canEdit =
          (role === "ADMIN" || role === "PURCHASER") &&
          req.paymentStatus !== "PAID" &&
          req.paymentStatus !== "REIMBURSED";
        const display =
          value != null && Number.isFinite(value) ? `￥${value.toFixed(2)}` : "-";

        if (canEdit) {
          return (
            <button
              type="button"
              className="flex w-[80px] items-center justify-end gap-1 text-right tabular-nums text-blue-600 decoration-dashed underline-offset-4 hover:underline"
              title={
                req.paymentStatus === "APPROVED_FUNDS"
                  ? "老板已批准原金额，修改需二次确认"
                  : "编辑实际金额"
              }
              onClick={(event) => {
                event.stopPropagation();
                options.onAdminEditCost(req);
              }}
            >
              <span>{display}</span>
              <PencilLine className="h-3.5 w-3.5 shrink-0" />
            </button>
          );
        }

        return value != null && Number.isFinite(value) ? (
          <span className="block w-[80px] text-right tabular-nums font-medium text-slate-800">
            {display}
          </span>
        ) : (
          <span className="block w-[80px] text-right text-xs text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "supplierName",
      header: () => <span className="block max-w-[150px] truncate">供应商</span>,
      enableSorting: true,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const req = row.original;
        const value = (row.getValue("supplierName") as string | null)?.trim();
        const canEdit =
          (role === "ADMIN" || role === "PURCHASER") &&
          req.paymentStatus !== "PAID" &&
          req.paymentStatus !== "REIMBURSED";
        const warnBeforePayment =
          req.paymentStatus === "PENDING_FUNDS" ||
          req.paymentStatus === "APPROVED_FUNDS" ||
          req.paymentStatus === "PENDING_REIMBURSEMENT" ||
          req.paymentStatus === "APPROVED_REIMBURSEMENT";
        const changedAfterApproval = hasSupplierChangeAfterApproval(req);
        const editButtonClass = warnBeforePayment
          ? "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
          : "text-slate-400 hover:text-slate-700";

        return (
          <div className="flex max-w-[150px] items-center gap-1">
            <span
              className="block min-w-0 flex-1 truncate text-sm text-slate-700"
              title={value || "未填写供应商"}
            >
              {value || "-"}
            </span>
            {changedAfterApproval && (
              <span
                className="shrink-0 rounded-sm bg-amber-100 px-1 text-[10px] font-medium text-amber-700"
                title="供应商信息在老板批准打款后发生过变动，请财务复核"
              >
                变更
              </span>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={`h-6 w-6 shrink-0 ${editButtonClass}`}
                title={
                  warnBeforePayment
                    ? "当前单据已进入打款流程，修改供应商信息需谨慎"
                    : "编辑供应商信息"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  options.onEditSupplier(req);
                }}
              >
                <PencilLine className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        const value = filterValue.trim().toLowerCase();
        if (!value) return true;
        return String(row.getValue("supplierName") ?? "")
          .toLowerCase()
          .includes(value);
      },
    },
    {
      accessorKey: "settlementType",
      header: () => <span className="block w-[80px] text-center">结算</span>,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const req = row.original;
        const canEdit =
          (role === "ADMIN" || role === "PURCHASER") &&
          req.paymentStatus !== "PAID" &&
          req.paymentStatus !== "REIMBURSED" &&
          !ACTIVE_PAYMENT_FLOW_STATUSES.includes(req.paymentStatus);
        return <SettlementTypeCell row={req} canEdit={canEdit} />;
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        return row.getValue("settlementType") === filterValue;
      },
    },
    {
      accessorKey: "paymentStatus",
      header: () => <span className="block w-[100px] text-center">付款</span>,
      cell: ({ row }) => {
        const status = row.getValue("paymentStatus") as PaymentStatus;
        const cfg = paymentBadge[status];
        return (
          <div className="flex w-[100px] justify-center">
            <Badge variant="default" className={cfg.className}>
              {cfg.label}
            </Badge>
          </div>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        if (filterValue === "__pending_funds__") {
          const status = row.getValue("paymentStatus");
          return (
            status === "PENDING_FUNDS" ||
            status === "APPROVING" ||
            status === "PENDING_REIMBURSEMENT"
          );
        }
        if (filterValue === "__finance__") {
          const status = row.getValue("paymentStatus");
          return (
            status === "APPROVED_FUNDS" ||
            status === "APPROVED_REIMBURSEMENT" ||
            status === "PAID" ||
            status === "REIMBURSED"
          );
        }
        return row.getValue("paymentStatus") === filterValue;
      },
    },
    {
      accessorKey: "paymentApprovedAt",
      header: () => (
        <span className="block w-[110px] text-center text-muted-foreground">
          批款时间
        </span>
      ),
      enableSorting: true,
      cell: ({ row }) => {
        const value = row.getValue("paymentApprovedAt") as Date | string | null;
        return value ? (
          <span className="block w-[110px] text-center text-xs tabular-nums text-muted-foreground">
            {formatInShanghai(value, "MM-DD HH:mm")}
          </span>
        ) : (
          <span className="block w-[110px] text-center text-xs text-slate-400">-</span>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        const value = row.getValue("paymentApprovedAt") as Date | string | null;
        return value ? formatInShanghai(value, "YYYY-MM-DD") === filterValue : false;
      },
    },
    {
      accessorKey: "invoiceNo",
      header: () => <span className="block max-w-[140px] truncate">发票号</span>,
      cell: ({ row }) => {
        const value = row.getValue("invoiceNo") as string | null;
        return value?.trim() ? (
          <span className="max-w-[140px] truncate font-mono text-xs text-slate-700" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: () => <span className="block w-[100px] text-center">状态</span>,
      cell: ({ row }) => {
        const req = row.original;
        const status = row.getValue("status") as PurchaseStatus;
        const cfg = needsInvoice(req)
          ? { label: "待发票", className: "bg-amber-500/90 text-white" }
          : isPurchaseClosed(req)
            ? { label: "已结束", className: "bg-emerald-600/90 text-white" }
          : statusConfig[status];
        return (
          <div className="flex w-[100px] justify-center">
            <Badge variant="default" className={cfg.className}>
              {cfg.label}
            </Badge>
          </div>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        const status = row.getValue("status") as string;
        if (filterValue === "__active__") {
          return (
            status === "APPROVED" ||
            status === "ORDERED" ||
            (status === "RECEIVED" && !isPurchaseClosed(row.original))
          );
        }
        if (filterValue === "__done__") {
          return (
            isPurchaseClosed(row.original) ||
            status === "REJECTED" ||
            status === "CANCELLED"
          );
        }
        return status === filterValue;
      },
    },
    {
      accessorKey: "remark",
      header: () => <span className="block max-w-[160px] truncate">备注</span>,
      cell: ({ row }) => {
        const value = row.getValue("remark") as string | null;
        return value ? (
          <span className="max-w-[160px] truncate text-xs text-slate-500" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <span className="block w-[110px] text-center text-muted-foreground">
          申请时间
        </span>
      ),
      cell: ({ row }) =>
        <span className="block w-[110px] text-center text-xs tabular-nums text-muted-foreground">
          {formatInShanghai(
            row.getValue("createdAt") as Date | string,
            "MM-DD HH:mm"
          )}
        </span>,
    },
    {
      id: "actions",
      header: () => <span className="block w-[56px] text-center">操作</span>,
      cell: ({ row }) => {
        const req = row.original;
        const isHardTerminal =
          req.status === "REJECTED" ||
          req.status === "CANCELLED";
        const needsInvoiceNo = needsInvoice(req);

        if (
          (isHardTerminal && role !== "ADMIN") ||
          (isPurchaseClosed(req) && role !== "ADMIN" && role !== "PURCHASER")
        ) {
          return <span className="block w-[56px] text-center text-xs text-slate-400">已结束</span>;
        }

        const canApprove = role === "BOSS" || role === "ADMIN";
        const canPurchaser = role === "PURCHASER" || role === "ADMIN";
        const isEngineer = role === "ENGINEER";
        const showApproveReject = canApprove && req.status === "PENDING";
        const showOrdered = canPurchaser && req.status === "APPROVED";
        const showReceived = canPurchaser && req.status === "ORDERED";
        const showMarkAsPaid =
          (role === "BOSS" || role === "ADMIN") &&
          (req.status === "ORDERED" || req.status === "RECEIVED") &&
          req.paymentStatus !== "PAID" &&
          req.paymentStatus !== "REIMBURSED";
        const canEditActualCost =
          (role === "ADMIN" || role === "PURCHASER") &&
          req.paymentStatus !== "PAID" &&
          req.paymentStatus !== "REIMBURSED";
        const showEditInvoice =
          (role === "ADMIN" || role === "PURCHASER") &&
          (req.status === "ORDERED" || req.status === "RECEIVED");
        const showPrintContract =
          (canPurchaser || canApprove) &&
          req.status === "ORDERED" &&
          req.actualCost != null &&
          Number.isFinite(req.actualCost) &&
          req.actualCost >= LARGE_AMOUNT;
        const showAdminDelete = role === "ADMIN";
        const showDelete =
          req.status === "PENDING" &&
          isEngineer &&
          req.applicant.trim() === sessionName.trim();
        const applicantTrim = req.applicant.trim();
        const showWithdraw =
          req.status === "PENDING" &&
          (applicantTrim === sessionName.trim() ||
            applicantTrim === sessionUserId.trim());

        if (
          !showApproveReject &&
          !showOrdered &&
          !showReceived &&
          !showMarkAsPaid &&
          !showEditInvoice &&
          !showPrintContract &&
          !showDelete &&
          !showAdminDelete &&
          !showWithdraw &&
          !canEditActualCost &&
          role !== "ADMIN"
        ) {
          if (needsInvoiceNo) {
            return (
              <span className="block w-[56px] text-center text-xs font-medium text-amber-600">
                待发票
              </span>
            );
          }
          return <span className="block w-[56px] text-center text-xs text-slate-400">-</span>;
        }

        return (
          <div className="flex w-[56px] justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">操作</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showApproveReject && (
                <>
                  <DropdownMenuItem onClick={() => options.onApprove(req)}>
                    <Check />
                    同意
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => options.onReject(req)}
                  >
                    <X />
                    驳回
                  </DropdownMenuItem>
                </>
              )}
              {showOrdered && (
                <DropdownMenuItem onClick={() => options.onMarkOrdered(req)}>
                  <ShoppingCart />
                  标记已采购
                </DropdownMenuItem>
              )}
              {showReceived && (
                <DropdownMenuItem onClick={() => options.onMarkReceived(req)}>
                  <PackageCheck />
                  确认入库
                </DropdownMenuItem>
              )}
              {showMarkAsPaid && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => options.onMarkAsPaid(req)}>
                    <CircleCheck />
                    标记为已付款
                  </DropdownMenuItem>
                </>
              )}
              {showEditInvoice && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => options.onEditInvoice(req)}>
                    <Receipt />
                    录入/修改发票
                  </DropdownMenuItem>
                </>
              )}
              {showPrintContract && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => options.onPrintContract(req)}>
                    <FileText />
                    生成合同
                  </DropdownMenuItem>
                </>
              )}
              {showWithdraw && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => options.onWithdraw(req)}>
                    <Undo2 />
                    撤回申请
                  </DropdownMenuItem>
                </>
              )}
              {showDelete && !showAdminDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => options.onDelete(req)}
                  >
                    <Trash2 />
                    删除
                  </DropdownMenuItem>
                </>
              )}
              {canEditActualCost && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => options.onAdminEditCost(req)}>
                    <PencilLine />
                    补录/修改金额
                  </DropdownMenuItem>
                </>
              )}
              {showAdminDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => options.onDelete(req)}
                  >
                    <Trash2 className="text-red-600" />
                    <span className="font-medium text-red-600">
                      删除记录（管理员）
                    </span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
