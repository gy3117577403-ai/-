"use client";

import { useState, useTransition } from "react";
import type { ThreeDMold } from "@prisma/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { MoldDialog } from "@/components/molds/mold-dialog";
import { deleteMold } from "@/lib/actions/mold";
import { toast } from "sonner";

export function MoldsClient({
  data,
  role,
}: {
  data: ThreeDMold[];
  role: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<ThreeDMold | null>(null);
  const [, startTransition] = useTransition();

  const canManage = role === "ADMIN" || role === "ENGINEER";

  function handleEdit(row: ThreeDMold) {
    setEditData(row);
    setDialogOpen(true);
  }

  function handleDelete(row: ThreeDMold) {
    if (!confirm(`确定删除模具 "${row.name}" 吗？此操作不可恢复。`)) return;
    startTransition(async () => {
      try {
        await deleteMold(row.id);
        toast.success("已删除模具记录");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditData(null);
  }

  const columns = getColumns({
    role,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3D打印模具库</h1>
          <p className="mt-1 text-sm text-slate-500">
            OpenSCAD 建模源码仓储与打印参数知识库
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            录入新模具
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <MoldDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editData={editData}
      />
    </>
  );
}
