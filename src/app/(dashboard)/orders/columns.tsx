"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Order, Product, Customer } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SHORTAGE_UNMATCHED_JIG_PREFIX } from "@/lib/order-constants";

type OrderRow = Order & {
  product: Product & { customer: Customer };
};

const statusConfig: Record<string, { label: string; className: string }> = {
  READY: {
    label: "齐套可生产",
    className: "bg-emerald-500/90 text-white",
  },
  NO_BOM: {
    label: "待工程配BOM",
    className: "bg-slate-400 text-white",
  },
};

export function getColumns(options: {
  onDelete: (row: OrderRow) => void;
}): ColumnDef<OrderRow>[] {
  return [
    {
      accessorKey: "orderNo",
      header: "工单号",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-800">
          {row.getValue("orderNo")}
        </span>
      ),
    },
    {
      id: "customer",
      header: "客户",
      cell: ({ row }) => row.original.product.customer.name,
    },
    {
      id: "productCode",
      header: "产品规格",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          {row.original.product.code}
        </Badge>
      ),
    },
    {
      accessorKey: "plannedQty",
      header: "计划产量",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {(row.getValue("plannedQty") as number).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const info = row.original.shortageInfo;
        if (status === "SHORTAGE") {
          const isUnmatched =
            typeof info === "string" &&
            info.trimStart().startsWith(SHORTAGE_UNMATCHED_JIG_PREFIX);
          if (isUnmatched) {
            return (
              <Badge
                variant="default"
                className="bg-amber-500 text-white hover:bg-amber-500"
              >
                待匹配治具
              </Badge>
            );
          }
          return (
            <Badge
              variant="default"
              className="bg-red-500 text-white hover:bg-red-500"
            >
              缺料需采购
            </Badge>
          );
        }
        const cfg = statusConfig[status] ?? statusConfig.READY;
        return (
          <Badge variant="default" className={cfg.className}>
            {cfg.label}
          </Badge>
        );
      },
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue) return true;
        return row.getValue("status") === filterValue;
      },
    },
    {
      accessorKey: "shortageInfo",
      header: "缺料详情",
      cell: ({ row }) => {
        const status = row.original.status;
        const info = row.getValue("shortageInfo") as string | null;
        if (status !== "SHORTAGE" || !info) {
          return <span className="text-slate-400">-</span>;
        }
        if (info.trimStart().startsWith(SHORTAGE_UNMATCHED_JIG_PREFIX)) {
          return (
            <div className="flex max-w-[360px] flex-wrap gap-1">
              <Badge className="whitespace-normal bg-amber-500/90 text-[11px] text-white hover:bg-amber-500/90">
                {info.trim()}
              </Badge>
            </div>
          );
        }
        const parts = info.split(";").map((s) => s.trim()).filter(Boolean);
        return (
          <div className="flex max-w-[360px] flex-wrap gap-1">
            {parts.map((part, i) => (
              <Badge
                key={i}
                variant="destructive"
                className="whitespace-nowrap text-[11px]"
              >
                {part}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "operator",
      header: "操作员",
    },
    {
      accessorKey: "createdAt",
      header: "开工时间",
      cell: ({ row }) =>
        format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm"),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">操作菜单</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={
                  <Link href={`/products/${order.productId}/bom`} />
                }
              >
                <Eye />
                查看 BOM 清单
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => options.onDelete(order)}
              >
                <Trash2 />
                删除开工单
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
