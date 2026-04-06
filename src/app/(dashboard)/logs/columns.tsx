"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { OperationLog } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const columns: ColumnDef<OperationLog>[] = [
  {
    accessorKey: "createdAt",
    header: "时间",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-slate-600">
        {format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm:ss")}
      </span>
    ),
  },
  {
    accessorKey: "operator",
    header: "操作人",
    cell: ({ row }) => (
      <span className="font-medium text-slate-800">
        {row.getValue("operator")}
      </span>
    ),
  },
  {
    accessorKey: "action",
    header: "动作",
    cell: ({ row }) => (
      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
        {row.getValue("action")}
      </Badge>
    ),
  },
  {
    accessorKey: "module",
    header: "模块",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-slate-700">
        {row.getValue("module")}
      </span>
    ),
  },
  {
    accessorKey: "details",
    header: "详情",
    cell: ({ row }) => (
      <span className="text-sm text-slate-600 break-all">
        {row.getValue("details")}
      </span>
    ),
  },
];
