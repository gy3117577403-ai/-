"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { PurchaseRequest, PurchaseStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<
  PurchaseStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "待审批", className: "bg-amber-500/90 text-white" },
  APPROVED: { label: "已批准", className: "bg-blue-500/90 text-white" },
  REJECTED: { label: "已驳回", className: "bg-slate-400 text-white" },
  ORDERED: { label: "已采购", className: "bg-indigo-500/90 text-white" },
  RECEIVED: { label: "已入库", className: "bg-emerald-500/90 text-white" },
};

export function getColumns(options: {
  role: string;
  sessionName: string;
  onApprove: (row: PurchaseRequest) => void;
  onReject: (row: PurchaseRequest) => void;
  onMarkOrdered: (row: PurchaseRequest) => void;
  onMarkReceived: (row: PurchaseRequest) => void;
  onDelete: (row: PurchaseRequest) => void;
}): ColumnDef<PurchaseRequest>[] {
  const { role, sessionName } = options;

  return [
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
      header: "物资型号",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
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
          return s === "RECEIVED" || s === "REJECTED";
        return s === filterValue;
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
        format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm"),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const req = row.original;
        const isTerminal =
          req.status === "RECEIVED" || req.status === "REJECTED";

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
        const showAdminDelete = role === "ADMIN";
        const showDelete =
          req.status === "PENDING" &&
          isEngineer &&
          req.applicant.trim() === sessionName.trim();

        if (
          !showApproveReject &&
          !showOrdered &&
          !showReceived &&
          !showDelete &&
          !showAdminDelete
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
              {showDelete && !showAdminDelete && (
                <>
                  {(showApproveReject || showOrdered || showReceived) && (
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
