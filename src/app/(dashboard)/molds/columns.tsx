"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ThreeDMold } from "@prisma/client";
import { format } from "date-fns";
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
  Copy,
  Edit2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function getColumns(options: {
  role: string;
  onEdit: (row: ThreeDMold) => void;
  onDelete: (row: ThreeDMold) => void;
}): ColumnDef<ThreeDMold>[] {
  const { role } = options;

  async function handleCopy(code: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        toast.success("代码已复制");
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          toast.success("代码已复制");
        } catch {
          toast.error("复制失败");
        }
        textArea.remove();
      }
    } catch {
      toast.error("复制失败");
    }
  }

  return [
    {
      accessorKey: "name",
      header: "模具名称",
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">
          {row.getValue("name")}
        </span>
      ),
    },
    {
      accessorKey: "productModel",
      header: "适用产品型号",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-slate-700">
          {row.getValue("productModel")}
        </span>
      ),
    },
    {
      accessorKey: "printParams",
      header: "打印参数",
      cell: ({ row }) => {
        const p = row.getValue("printParams") as string | null;
        return p ? (
          <span className="text-sm text-slate-600">{p}</span>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: "更新时间",
      cell: ({ row }) =>
        format(new Date(row.getValue("updatedAt")), "yyyy-MM-dd HH:mm"),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const mold = row.original;
        const canManage = role === "ADMIN" || role === "ENGINEER";

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleCopy(mold.scadCode)}
              className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Copy className="h-3 w-3 mr-1" />
              一键复制代码
            </Button>
            
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" className="h-7 w-7" />}
                >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">操作</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => options.onEdit(mold)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    编辑信息
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => options.onDelete(mold)}
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                    <span className="text-red-600">删除</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];
}
