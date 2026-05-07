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
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Check,
  X,
  ShoppingCart,
  PackageCheck,
  ExternalLink,
  Trash2,
  Undo2,
  FileText,
  PencilLine,
  CircleCheck,
  Receipt,
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
  APPROVING: { label: "待付款审批", className: "bg-orange-500/90 text-white" },
  PAID: { label: "已付款", className: "bg-emerald-600/90 text-white" },
};

const LARGE_AMOUNT = 500;

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
      header: "单号",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-800">
          {row.getValue("requestNo")}
        </span>
      ),
    },
    {
      accessorKey: "applicant",
      header: "申请人",
    },
    {
      accessorKey: "itemName",
      header: () => <span className="whitespace-nowrap">物资型号</span>,
      cell: ({ row }) => (
        <span className="inline-block min-w-[200px] font-mono text-sm font-medium">
          {row.getValue("itemName")}
        </span>
      ),
    },
    {
      accessorKey: "quantity",
      header: "数量",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {(row.getValue("quantity") as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "estimatedCost",
      header: "预估金额",
      cell: ({ row }) => (
        <span className="tabular-nums">
          ¥{(row.getValue("estimatedCost") as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "actualCost",
      header: "实际金额",
      cell: ({ row }) => {
        const v = row.getValue("actualCost") as number | null;
        if (v != null && Number.isFinite(v)) {
          return (
            <span className="tabular-nums font-medium text-slate-800">
              ¥{v.toFixed(2)}
            </span>
          );
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
    {
      accessorKey: "invoiceNo",
      header: "发票号",
      cell: ({ row }) => {
        const req = row.original;
        if (req.status !== "ORDERED" && req.status !== "RECEIVED") {
          return <span className="text-xs text-slate-400">—</span>;
        }
        const inv = row.getValue("invoiceNo") as string | null;
        return inv?.trim() ? (
          <span
            className="max-w-[140px] truncate font-mono text-xs text-slate-700"
            title={inv}
          >
            {inv}
          </span>
        ) : (
          <span className="text-xs text-slate-400">未登记</span>
        );
      },
    },
    {
      accessorKey: "link",
      header: "链接",
      cell: ({ row }) => {
        const url = row.getValue("link") as string | null;
        if (!url) return <span className="text-slate-400">-</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            查看
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      },
    },
    {
      accessorKey: "status",
      header: "状态",
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
        const s = row.getValue("status") as string;
        if (filterValue === "__active__")
          return s === "APPROVED" || s === "ORDERED";
        if (filterValue === "__done__")
          return (
            s === "RECEIVED" || s === "REJECTED" || s === "CANCELLED"
          );
        return s === filterValue;
      },
    },
    {
      accessorKey: "paymentStatus",
      header: "付款状态",
      cell: ({ row }) => {
        const req = row.original;
        if (req.status !== "ORDERED" && req.status !== "RECEIVED") {
          return <span className="text-xs text-slate-400">—</span>;
        }
        const ps = row.getValue("paymentStatus") as PaymentStatus;
        const cfg = paymentBadge[ps];
        return (
          <Badge variant="default" className={cfg.className}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "remark",
      header: "备注",
      cell: ({ row }) => {
        const val = row.getValue("remark") as string | null;
        return val ? (
          <span
            className="max-w-[160px] truncate text-xs text-slate-500"
            title={val}
          >
            {val}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "申请时间",
      cell: ({ row }) =>
        formatInShanghai(
          row.getValue("createdAt") as Date | string,
          "YYYY-MM-DD HH:mm"
        ),
    },
    {
      id: "actions",
      header: "操作",
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

        const showApproveReject =
          canApprove && req.status === "PENDING";
        const showOrdered = canPurchaser && req.status === "APPROVED";
        const showReceived = canPurchaser && req.status === "ORDERED";
        const showMarkAsPaid =
          (role === "BOSS" || role === "ADMIN") &&
          (req.status === "ORDERED" || req.status === "RECEIVED") &&
          req.paymentStatus !== "PAID";
        const showEditInvoice =
          (role === "ADMIN" || role === "BOSS" || role === "PURCHASER") &&
          (req.status === "ORDERED" || req.status === "RECEIVED");
        const actual = req.actualCost;
        const showPrintContract =
          (canPurchaser || canApprove) &&
          req.status === "ORDERED" &&
          actual != null &&
          Number.isFinite(actual) &&
          actual >= LARGE_AMOUNT;
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
          !showWithdraw
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
                  已采购
                </DropdownMenuItem>
              )}
              {showReceived && (
                <DropdownMenuItem onClick={() => options.onMarkReceived(req)}>
                  <PackageCheck />
                  已入库
                </DropdownMenuItem>
              )}
              {showMarkAsPaid && (
                <>
                  {(showApproveReject || showOrdered || showReceived) && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem onClick={() => options.onMarkAsPaid(req)}>
                    <CircleCheck />
                    标记为已付款
                  </DropdownMenuItem>
                </>
              )}
              {showEditInvoice && (
                <>
                  {(showApproveReject ||
                    showOrdered ||
                    showReceived ||
                    showMarkAsPaid) && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => options.onEditInvoice(req)}>
                    <Receipt />
                    录入/修改发票
                  </DropdownMenuItem>
                </>
              )}
              {showPrintContract && (
                <>
                  {(showApproveReject ||
                    showOrdered ||
                    showReceived ||
                    showMarkAsPaid ||
                    showEditInvoice) && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => options.onPrintContract(req)}>
                    <FileText />
                    生成合同
                  </DropdownMenuItem>
                </>
              )}
              {showWithdraw && (
                <>
                  {(showApproveReject ||
                    showOrdered ||
                    showReceived ||
                    showMarkAsPaid ||
                    showEditInvoice ||
                    showPrintContract) && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem onClick={() => options.onWithdraw(req)}>
                    <Undo2 />
                    撤回申请
                  </DropdownMenuItem>
                </>
              )}
              {showDelete && !showAdminDelete && (
                <>
                  {(showApproveReject ||
                    showOrdered ||
                    showReceived ||
                    showMarkAsPaid ||
                    showEditInvoice ||
                    showPrintContract ||
                    showWithdraw) && (
                    <DropdownMenuSeparator />
                  )}
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
                  {(showApproveReject ||
                    showOrdered ||
                    showReceived ||
                    showMarkAsPaid ||
                    showEditInvoice ||
                    showPrintContract ||
                    showWithdraw ||
                    (showDelete && !showAdminDelete)) && (
                    <DropdownMenuSeparator />
                  )}
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
                    <span className="text-red-600 font-medium">
                      删除记录 (管理员)
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
