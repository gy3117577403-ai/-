"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { JigBaseInventory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export function getColumns(options: {
  onEdit: (row: JigBaseInventory) => void;
  onDelete: (row: JigBaseInventory) => void;
  hideMatingModel?: boolean;
}): ColumnDef<JigBaseInventory>[] {
  const cols: ColumnDef<JigBaseInventory>[] = [
    {
      accessorKey: "modelCode",
      header: "物资型号",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-800">
          {row.getValue("modelCode")}
        </span>
      ),
    },
  ];

  if (!options.hideMatingModel) {
    cols.push({
      accessorKey: "matingModel",
      header: "对插型号",
      cell: ({ row }) => {
        const val = row.getValue("matingModel") as string | null;
        return val ? (
          <span className="font-mono text-sm">{val}</span>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    });
  }

  cols.push(
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
      accessorKey: "remarks",
      header: "备注",
      cell: ({ row }) => {
        const val = row.getValue("remarks") as string | null;
        return val ? (
          <span className="max-w-[200px] truncate text-sm text-slate-600">
            {val}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">操作菜单</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => options.onEdit(item)}>
                <Pencil />
                编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => options.onDelete(item)}
              >
                <Trash2 />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }
  );

  return cols;
}
