"use client";

import { useState, useTransition } from "react";
import type { JigBaseInventory } from "@prisma/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { JigDialog } from "@/components/jig-inventory/jig-dialog";
import { ImportExcelButton } from "@/components/jig-inventory/import-excel-button";
import { deleteJigInventory } from "@/lib/actions/jig-inventory";
import { toast } from "sonner";

export function JigInventoryClient({ data }: { data: JigBaseInventory[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<JigBaseInventory | null>(null);
  const [categoryTab, setCategoryTab] = useState<"JIG" | "OTHER">("JIG");
  const [, startTransition] = useTransition();

  function handleEdit(row: JigBaseInventory) {
    setEditData(row);
    setDialogOpen(true);
  }

  function handleDelete(row: JigBaseInventory) {
    if (!confirm(`确定要删除型号「${row.modelCode}」的库存记录吗？`)) return;
    startTransition(async () => {
      try {
        await deleteJigInventory(row.id);
        toast.success("删除成功");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  const filteredData = data.filter((d) => d.category === categoryTab);
  const columns = getColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    hideMatingModel: categoryTab === "OTHER",
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">全厂物资总仓</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理生产治具与其他工具设备库存，支持 Excel 批量导入
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExcelButton />
          <Button
            onClick={() => {
              setEditData(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            手动录入
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        categoryTab={categoryTab}
        onCategoryChange={setCategoryTab}
      />

      <JigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editData={editData}
      />
    </>
  );
}
