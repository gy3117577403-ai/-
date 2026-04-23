"use client";

import { useRef, useState, useTransition } from "react";
import type { PurchaseRequest, PurchaseStatus } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { FilePlus2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { CreatePurchaseDialog } from "@/components/purchases/create-purchase-dialog";
import {
  cancelPurchaseRequestAction,
  deletePurchaseRequest,
  updatePurchaseStatus,
} from "@/lib/actions/purchase";
import { formatInShanghai, shanghaiFileTimestamp } from "@/lib/dayjs-shanghai";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const purchaseStatusZh: Record<PurchaseStatus, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  REJECTED: "已驳回",
  ORDERED: "已采购",
  RECEIVED: "已入库",
  CANCELLED: "已撤回",
};

type PurchaseExportZhRow = {
  单号: string;
  申请人: string;
  物资型号: string;
  数量: number;
  总额: number;
  状态: string;
  时间: string;
};

function mapPurchasesToExportRows(rows: PurchaseRequest[]): PurchaseExportZhRow[] {
  return rows.map((r) => ({
    单号: r.requestNo,
    申请人: r.applicant,
    物资型号: r.itemName,
    数量: r.quantity,
    总额: r.estimatedCost,
    状态: purchaseStatusZh[r.status],
    时间: formatInShanghai(r.createdAt, "YYYY-MM-DD HH:mm"),
  }));
}

function exportPurchasesToExcel(rows: PurchaseRequest[]) {
  const sheetData = mapPurchasesToExportRows(rows);
  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "采购申请");
  const filename = `采购申请导出_${shanghaiFileTimestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function PurchasesClient({
  data,
  role,
  sessionName,
  sessionUserId,
  enableConfetti,
}: {
  data: PurchaseRequest[];
  role: string;
  sessionName: string;
  sessionUserId: string;
  enableConfetti: boolean;
}) {
  const tableRef = useRef<Table<PurchaseRequest> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(
    null
  );
  const [rejectRemark, setRejectRemark] = useState("");
  const [rejectPending, startRejectTransition] = useTransition();

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
    setRejectTarget(row);
    setRejectRemark("");
    setRejectOpen(true);
  }

  function handleConfirmReject() {
    if (!rejectTarget) return;
    const remark = rejectRemark.trim();
    if (!remark) {
      toast.error("请填写驳回理由");
      return;
    }
    startRejectTransition(async () => {
      try {
        await updatePurchaseStatus(rejectTarget.id, "REJECTED", remark);
        toast.success(`请购单 ${rejectTarget.requestNo} 已驳回`);
        setRejectOpen(false);
        setRejectTarget(null);
        setRejectRemark("");
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
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  function handleWithdraw(row: PurchaseRequest) {
    if (!confirm(`确定撤回请购单 ${row.requestNo}？撤回后本条需求将关闭。`)) return;
    startTransition(async () => {
      try {
        await cancelPurchaseRequestAction(row.id);
        toast.success("已撤回申请");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "撤回失败");
      }
    });
  }

  function handleExportExcel() {
    const table = tableRef.current;
    if (!table) {
      toast.error("表格未就绪，请稍后重试");
      return;
    }
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    if (!rows.length) {
      toast.error("当前没有可导出的数据");
      return;
    }
    try {
      exportPurchasesToExcel(rows);
      toast.success(`已导出 ${rows.length} 条记录`);
    } catch {
      toast.error("导出失败");
    }
  }

  const columns = getColumns({
    role,
    sessionName,
    sessionUserId,
    onApprove: handleApprove,
    onReject: handleReject,
    onMarkOrdered: handleMarkOrdered,
    onMarkReceived: handleMarkReceived,
    onDelete: handleDelete,
    onWithdraw: handleWithdraw,
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" onClick={handleExportExcel}>
            <Download className="mr-1.5 h-4 w-4" />
            导出当前数据
          </Button>
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <FilePlus2 className="mr-1.5 h-4 w-4" />
            新建请购
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        tableRef={tableRef}
      />

      <CreatePurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) {
            setRejectTarget(null);
            setRejectRemark("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>驳回请购单</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `请填写驳回理由（单号 ${rejectTarget.requestNo}）`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-remark">驳回理由</Label>
            <Textarea
              id="reject-remark"
              placeholder="请说明驳回原因，便于申请人修改后重新提交…"
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              rows={4}
              className="min-h-[100px] resize-y"
              disabled={rejectPending}
            />
          </div>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejectPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectPending}
            >
              {rejectPending ? "提交中…" : "确认驳回"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
