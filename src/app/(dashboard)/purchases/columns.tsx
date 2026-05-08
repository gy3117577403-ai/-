"use client";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
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
import { formatInShanghai } from "@/lib/dayjs-shanghai";

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
  PAID: { label: "已付款", className: "bg-emerald-600/90 text-white" },
};

const LARGE_AMOUNT = 500;

function compactRequestNo(value: string) {
  return value.length > 6 ? `...${value.slice(-6)}` : value;
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
}): ColumnDef<PurchaseRequest>[] {
  const { role, sessionName, sessionUserId } = options;

  return [
    {
      id: "select",
      header: ({ table }) => (
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
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="选择行"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "requestNo",
      header: () => <span className="whitespace-nowrap">单号</span>,
      cell: ({ row }) => {
        const requestNo = row.getValue("requestNo") as string;
        return (
          <span
            className="font-mono text-xs text-muted-foreground whitespace-nowrap"
            title={requestNo}
          >
            {compactRequestNo(requestNo)}
          </span>
        );
      },
    },
    {
      accessorKey: "applicant",
      header: () => <span className="whitespace-nowrap">申请人</span>,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.getValue("applicant") as string}
        </span>
      ),
    },
    {
      accessorKey: "itemName",
      header: () => <span className="whitespace-nowrap">物资名称</span>,
      cell: ({ row }) => {
        const itemName = row.getValue("itemName") as string;
        const url = row.original.link?.trim();
        if (url) {
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[220px] items-center gap-1 truncate align-middle font-mono text-sm font-medium text-blue-600 hover:underline"
              title={itemName}
            >
              <span className="truncate">{itemName}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          );
        }
        return (
          <span
            className="inline-block max-w-[220px] truncate font-mono text-sm font-medium"
            title={itemName}
          >
            {itemName}
          </span>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: () => <span className="whitespace-nowrap">数量</span>,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums font-medium">
          {(row.getValue("quantity") as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "estimatedCost",
      header: () => <span className="whitespace-nowrap">预估</span>,
      enableSorting: true,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          ￥{(row.getValue("estimatedCost") as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "actualCost",
      header: () => <span className="whitespace-nowrap">实际</span>,
      enableSorting: true,
      cell: ({ row }) => {
        const value = row.getValue("actualCost") as number | null;
        return value != null && Number.isFinite(value) ? (
          <span className="whitespace-nowrap tabular-nums font-medium text-slate-800">
            ￥{value.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "supplierName",
      header: () => <span className="whitespace-nowrap">供应商</span>,
      enableSorting: true,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const value = row.getValue("supplierName") as string | null;
        return value?.trim() ? (
          <span
            className="block max-w-[150px] truncate whitespace-nowrap text-sm text-slate-700"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
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
      header: () => <span className="whitespace-nowrap">结算</span>,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const value = row.getValue("settlementType") as string | null;
        return value?.trim() ? (
          <span className="whitespace-nowrap text-sm">{value}</span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        return row.getValue("settlementType") === filterValue;
      },
    },
    {
      accessorKey: "paymentStatus",
      header: () => <span className="whitespace-nowrap">付款</span>,
      cell: ({ row }) => {
        const status = row.getValue("paymentStatus") as PaymentStatus;
        const cfg = paymentBadge[status];
        return (
          <Badge variant="default" className={cfg.className}>
            {cfg.label}
          </Badge>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        if (filterValue === "__pending_funds__") {
          const status = row.getValue("paymentStatus");
          return status === "PENDING_FUNDS" || status === "APPROVING";
        }
        if (filterValue === "__finance__") {
          const status = row.getValue("paymentStatus");
          return status === "APPROVED_FUNDS" || status === "PAID";
        }
        return row.getValue("paymentStatus") === filterValue;
      },
    },
    {
      accessorKey: "paymentApprovedAt",
      header: () => <span className="whitespace-nowrap">批款时间</span>,
      enableSorting: true,
      cell: ({ row }) => {
        const value = row.getValue("paymentApprovedAt") as Date | string | null;
        return value ? (
          <span className="whitespace-nowrap text-xs tabular-nums">
            {formatInShanghai(value, "MM-DD HH:mm")}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
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
      header: () => <span className="whitespace-nowrap">发票号</span>,
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
      header: () => <span className="whitespace-nowrap">状态</span>,
      cell: ({ row }) => {
        const status = row.getValue("status") as PurchaseStatus;
        const cfg = statusConfig[status];
        return (
          <Badge variant="default" className={cfg.className}>
            {cfg.label}
          </Badge>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        const status = row.getValue("status") as string;
        if (filterValue === "__active__") {
          return status === "APPROVED" || status === "ORDERED";
        }
        if (filterValue === "__done__") {
          return (
            status === "RECEIVED" ||
            status === "REJECTED" ||
            status === "CANCELLED"
          );
        }
        return status === filterValue;
      },
    },
    {
      accessorKey: "remark",
      header: () => <span className="whitespace-nowrap">备注</span>,
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
      header: () => <span className="whitespace-nowrap">申请时间</span>,
      cell: ({ row }) =>
        <span className="whitespace-nowrap text-xs tabular-nums">
          {formatInShanghai(
            row.getValue("createdAt") as Date | string,
            "MM-DD HH:mm"
          )}
        </span>,
    },
    {
      id: "actions",
      header: () => <span className="whitespace-nowrap">操作</span>,
      cell: ({ row }) => {
        const req = row.original;
        const isTerminal =
          req.status === "RECEIVED" ||
          req.status === "REJECTED" ||
          req.status === "CANCELLED";

        if (isTerminal && role !== "ADMIN") {
          return <span className="text-xs text-slate-400">已结束</span>;
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
          req.paymentStatus !== "PAID";
        const showEditInvoice =
          (role === "ADMIN" || role === "BOSS" || role === "PURCHASER") &&
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
          role !== "ADMIN"
        ) {
          return <span className="text-xs text-slate-400">-</span>;
        }

        return (
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
              {role === "ADMIN" && (
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
        );
      },
    },
  ];
}
