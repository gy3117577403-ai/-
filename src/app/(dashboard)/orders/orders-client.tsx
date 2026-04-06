"use client";

import { useState, useTransition } from "react";
import type { Order, Product, Customer } from "@prisma/client";
import { ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { deleteOrder } from "@/lib/actions/order";
import { toast } from "sonner";

type OrderRow = Order & { product: Product & { customer: Customer } };
type CustomerWithProducts = Customer & {
  products: { id: string; code: string; name: string }[];
};

export function OrdersClient({
  orders,
  customers,
}: {
  orders: OrderRow[];
  customers: CustomerWithProducts[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete(row: OrderRow) {
    if (!confirm(`确定要删除工单「${row.orderNo}」吗？此操作不可撤销。`)) return;
    startTransition(async () => {
      try {
        await deleteOrder(row.id);
        toast.success("开工单已删除");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  const columns = getColumns({ onDelete: handleDelete });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">生产开工记录</h1>
          <p className="mt-1 text-sm text-slate-500">
            创建开工单时系统自动校验 BOM 治具齐套性
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <ClipboardPlus className="mr-1.5 h-4 w-4" />
          新建开工
        </Button>
      </div>

      <DataTable columns={columns} data={orders} />

      <CreateOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customers={customers}
      />
    </>
  );
}
