"use client";

import { useState, useTransition } from "react";
import type { PurchaseRequest } from "@prisma/client";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { CreatePurchaseDialog } from "@/components/purchases/create-purchase-dialog";
import {
  deletePurchaseRequest,
  updatePurchaseStatus,
} from "@/lib/actions/purchase";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export function PurchasesClient({
  data,
  role,
  sessionName,
  enableConfetti,
}: {
  data: PurchaseRequest[];
  role: string;
  sessionName: string;
  enableConfetti: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleApprove(row: PurchaseRequest) {
    startTransition(async () => {
      try {
        await updatePurchaseStatus(row.id, "APPROVED");
        toast.success(`请购单 ${row.requestNo} 已同意`);
        if (enableConfetti) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999,
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function handleReject(row: PurchaseRequest) {
    const reason = prompt("请输入驳回理由：");
    if (reason === null) return;
    startTransition(async () => {
      try {
        await updatePurchaseStatus(row.id, "REJECTED", reason);
        toast.success(`请购单 ${row.requestNo} 已驳回`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function handleMarkOrdered(row: PurchaseRequest) {
    startTransition(async () => {
      try {
        await updatePurchaseStatus(row.id, "ORDERED");
        toast.success(`请购单 ${row.requestNo} 已标记已采购`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function handleMarkReceived(row: PurchaseRequest) {
    if (
      !confirm(
        `确认入库？这将自动把 ${row.quantity} 个「${row.itemName}」累加到治具总仓库存。`
      )
    )
      return;
    startTransition(async () => {
      try {
        await updatePurchaseStatus(row.id, "RECEIVED");
        toast.success(
          `已入库！${row.quantity} 个「${row.itemName}」已累加至总仓`
        );
        if (enableConfetti) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999,
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function handleDelete(row: PurchaseRequest) {
    if (!confirm(`确定删除请购单 ${row.requestNo}？`)) return;
    startTransition(async () => {
      try {
        await deletePurchaseRequest(row.id);
        toast.success("已删除");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  const columns = getColumns({
    role,
    sessionName,
    onApprove: handleApprove,
    onReject: handleReject,
    onMarkOrdered: handleMarkOrdered,
    onMarkReceived: handleMarkReceived,
    onDelete: handleDelete,
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">物品采购审批</h1>
          <p className="mt-1 text-sm text-slate-500">
            申请 → 审批 → 采购 → 入库，入库自动同步总仓库存
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <FilePlus2 className="mr-1.5 h-4 w-4" />
          新建请购
        </Button>
      </div>

      <DataTable columns={columns} data={data} />

      <CreatePurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
