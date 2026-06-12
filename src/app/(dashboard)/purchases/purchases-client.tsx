"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentStatus, PurchaseRequest, PurchaseStatus } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import {
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { CreatePurchaseDialog } from "@/components/purchases/create-purchase-dialog";
import { BatchContractModal } from "@/components/purchases/batch-contract-modal";
import { BatchPaymentModal } from "@/components/purchases/batch-payment-modal";
import { EditSupplierModal } from "@/components/purchases/edit-supplier-modal";
import { ReimbursementModal } from "@/components/purchases/reimbursement-modal";
import { MarkOrderedDialog } from "./mark-ordered-dialog";
import {
  approveBatchPaymentAction,
  batchApprovePurchasesAction,
  batchRejectPurchasesAction,
  cancelPurchaseRequestAction,
  confirmPurchaseRefundAction,
  deletePurchaseRequest,
  financeConfirmPaymentAction,
  markAsPaidAction,
  returnPurchaseRequestAction,
  updateInvoiceNoAction,
  updatePurchaseActualCostAction,
  updatePurchaseStatus,
} from "@/lib/actions/purchase";
import { formatInShanghai, shanghaiFileTimestamp } from "@/lib/dayjs-shanghai";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const paymentStatusZh: Record<PaymentStatus, string> = {
  UNPAID: "未付款",
  APPROVING: "待打款审批",
  PENDING_FUNDS: "待打款审批",
  APPROVED_FUNDS: "待财务打款",
  PENDING_REIMBURSEMENT: "待报销审批",
  APPROVED_REIMBURSEMENT: "待财务报销",
  PAID: "已付款",
  PENDING_REFUND: "待退款",
  REFUNDED: "已退款",
  REIMBURSED: "已报销完成",
};

const purchaseStatusZh: Record<PurchaseStatus, string> = {
  PENDING: "待审批",
  APPROVED: "已批准",
  REJECTED: "已驳回",
  ORDERED: "已采购",
  RECEIVED: "已入库",
  RETURNED: "已退货",
  CANCELLED: "已撤回",
};

const PUBLIC_PAYMENT_PENDING_STATUSES = ["PENDING_FUNDS", "APPROVING"];
const PUBLIC_PAYMENT_APPROVED_STATUSES = ["APPROVED_FUNDS"];
const REIMBURSEMENT_PENDING_STATUSES = ["PENDING_REIMBURSEMENT"];
const REIMBURSEMENT_APPROVED_STATUSES = ["APPROVED_REIMBURSEMENT"];
const LOCKED_PAYMENT_STATUSES = [
  "PENDING_FUNDS",
  "APPROVING",
  "APPROVED_FUNDS",
  "PENDING_REIMBURSEMENT",
  "APPROVED_REIMBURSEMENT",
  "PENDING_REFUND",
  "REFUNDED",
  "PAID",
  "REIMBURSED",
];

function rowsEveryPaymentStatus(
  rows: PurchaseRequest[],
  statuses: readonly string[]
) {
  return rows.length > 0 && rows.every((row) => statuses.includes(row.paymentStatus));
}

function resolvePurchaseAmount(row: PurchaseRequest) {
  const actual = Number(row.actualCost);
  if (Number.isFinite(actual) && actual > 0) {
    return Math.round(actual * 100) / 100;
  }
  const estimated = Number(row.estimatedCost);
  if (Number.isFinite(estimated) && estimated > 0) {
    return Math.round(estimated * 100) / 100;
  }
  return 0;
}

function calculatePaymentAmountTotal(rows: PurchaseRequest[]) {
  return (
    rows.reduce((sum, row) => sum + Math.round(resolvePurchaseAmount(row) * 100), 0) /
    100
  );
}

function resolveBatchPaymentMode(rows: PurchaseRequest[]) {
  if (!rows.length) return null;
  const hasAdvance = rows.some((row) => row.settlementType === "采购垫付");
  const hasPublic = rows.some((row) => row.settlementType !== "采购垫付");
  if (hasAdvance && hasPublic) return "mixed";
  return hasAdvance ? "advance" : "public";
}

function resolveBatchPaymentInitialSettlementType(rows: PurchaseRequest[]) {
  const mode = resolveBatchPaymentMode(rows);
  if (mode === "advance") return "采购垫付";
  const publicType = rows.find(
    (row) => row.settlementType === "对公现结" || row.settlementType === "月结"
  )?.settlementType;
  return publicType ?? "月结";
}

function resolvePurchaseClosureStatus(row: PurchaseRequest) {
  const invoiceNo = row.invoiceNo?.trim();
  const settled = row.paymentStatus === "PAID" || row.paymentStatus === "REIMBURSED";

  if (row.status === "RETURNED") {
    return row.paymentStatus === "PENDING_REFUND"
      ? "已退货（待退款）"
      : row.paymentStatus === "REFUNDED"
        ? "已退货（已退款）"
        : "已退货";
  }
  if (row.status === "RECEIVED" && settled && invoiceNo) return "已结束";
  if (row.status === "RECEIVED" && settled && !invoiceNo) return "待发票";
  return purchaseStatusZh[row.status];
}

function mapPurchasesToDetailedExportRows(rows: PurchaseRequest[]) {
  return rows.map((r) => ({
    单号: r.requestNo,
    申请人: r.applicant,
    物资名称: r.itemName,
    数量: r.quantity,
    预估金额: r.estimatedCost,
    实际金额: r.actualCost ?? "",
    供应商名称: r.supplierName ?? "",
    结算方式: r.settlementType ?? "",
    发票号: r.invoiceNo ?? "",
    采购闭环状态: resolvePurchaseClosureStatus(r),
    付款状态: paymentStatusZh[r.paymentStatus],
    打款审批时间: r.paymentApprovedAt
      ? formatInShanghai(r.paymentApprovedAt, "YYYY-MM-DD HH:mm")
      : "",
  }));
}

function calculateActualCostTotal(rows: PurchaseRequest[]) {
  return (
    rows.reduce((sum, row) => {
      const actualCost = Number(row.actualCost);
      if (!Number.isFinite(actualCost)) return sum;
      return sum + Math.round(actualCost * 100);
    }, 0) / 100
  );
}

function exportPurchasesToExcel(rows: PurchaseRequest[]) {
  const sheetData: Array<Record<string, string | number>> =
    mapPurchasesToDetailedExportRows(rows);
  const totalActualCost = calculateActualCostTotal(rows);
  sheetData.push({
    单号: "合计 (Total)",
    申请人: "",
    物资名称: "",
    数量: "",
    预估金额: "",
    实际金额: totalActualCost.toFixed(2),
    供应商名称: "",
    结算方式: "",
    发票号: "",
    采购闭环状态: "",
    付款状态: "",
    打款审批时间: "",
  });
  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
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
  const router = useRouter();
  const tableRef = useRef<Table<PurchaseRequest> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchContractIds, setBatchContractIds] = useState<string[]>([]);
  const [batchPaymentRows, setBatchPaymentRows] = useState<PurchaseRequest[]>([]);
  const [reimbursementRows, setReimbursementRows] = useState<PurchaseRequest[]>([]);
  const [requestNoExpandedAll, setRequestNoExpandedAll] = useState(false);
  const [requestNoCollapseSignal, setRequestNoCollapseSignal] = useState(0);
  const [supplierNameExpandedAll, setSupplierNameExpandedAll] = useState(false);
  const [, startTransition] = useTransition();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(
    null
  );
  const [rejectRemark, setRejectRemark] = useState("");
  const [rejectPending, startRejectTransition] = useTransition();

  const [markOrderedOpen, setMarkOrderedOpen] = useState(false);
  const [markOrderedTarget, setMarkOrderedTarget] =
    useState<PurchaseRequest | null>(null);

  const [editCostOpen, setEditCostOpen] = useState(false);
  const [editCostTarget, setEditCostTarget] =
    useState<PurchaseRequest | null>(null);
  const [editCostValue, setEditCostValue] = useState("");
  const [editCostPending, startEditCostTransition] = useTransition();

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceTarget, setInvoiceTarget] =
    useState<PurchaseRequest | null>(null);
  const [invoiceValue, setInvoiceValue] = useState("");
  const [invoicePending, startInvoiceTransition] = useTransition();
  const [editSupplierTarget, setEditSupplierTarget] =
    useState<PurchaseRequest | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTarget, setReturnTarget] =
    useState<PurchaseRequest | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnPending, startReturnTransition] = useTransition();

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
    setMarkOrderedTarget(row);
    setMarkOrderedOpen(true);
  }

  function handleMarkAsPaid(row: PurchaseRequest) {
    startTransition(async () => {
      try {
        await markAsPaidAction(row.id);
        toast.success("付款已确认");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function handleReturnPurchase(row: PurchaseRequest) {
    setReturnTarget(row);
    setReturnReason("");
    setReturnOpen(true);
  }

  function handleConfirmReturnPurchase() {
    if (!returnTarget) return;
    const reason = returnReason.trim();
    if (!reason) {
      toast.error("请填写退货原因");
      return;
    }
    if (
      returnTarget.paymentStatus === "PAID" &&
      !confirm("该单据已付款，登记退货后将进入待退款状态，确定继续吗？")
    ) {
      return;
    }

    startReturnTransition(async () => {
      try {
        await returnPurchaseRequestAction(returnTarget.id, reason);
        toast.success(
          returnTarget.paymentStatus === "PAID"
            ? "已登记退货，待财务跟进退款"
            : "已登记退货"
        );
        setReturnOpen(false);
        setReturnTarget(null);
        setReturnReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "退货登记失败");
      }
    });
  }

  function handleConfirmRefund(row: PurchaseRequest) {
    if (!confirm(`确认采购单 ${row.requestNo} 的供应商退款已到账吗？`)) {
      return;
    }
    startTransition(async () => {
      try {
        await confirmPurchaseRefundAction(row.id);
        toast.success("已确认退款到账");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "确认退款失败");
      }
    });
  }

  function handleEditInvoice(row: PurchaseRequest) {
    setInvoiceTarget(row);
    setInvoiceValue(row.invoiceNo?.trim() ?? "");
    setInvoiceOpen(true);
  }

  function handleEditSupplier(row: PurchaseRequest) {
    setEditSupplierTarget(row);
  }

  function handleSaveInvoice() {
    if (!invoiceTarget) return;
    const nextInvoiceNo = invoiceValue.trim();
    if (
      invoiceTarget.invoiceNo?.trim() &&
      !nextInvoiceNo &&
      !confirm("清空已有发票号后，该采购单将回到待发票状态，确定继续吗？")
    ) {
      return;
    }
    startInvoiceTransition(async () => {
      try {
        await updateInvoiceNoAction(invoiceTarget.id, nextInvoiceNo);
        toast.success("发票已更新");
        setInvoiceOpen(false);
        setInvoiceTarget(null);
        setInvoiceValue("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handlePrintContract(row: PurchaseRequest) {
    window.open(
      `/print/contract/${row.id}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleAdminEditCost(row: PurchaseRequest) {
    if (
      row.paymentStatus === "APPROVED_FUNDS" &&
      !confirm(
        "老板已批准原金额，修改实际金额可能导致财务打款差异，确定修改吗？"
      )
    ) {
      return;
    }
    setEditCostTarget(row);
    setEditCostValue(
      row.actualCost != null && Number.isFinite(row.actualCost)
        ? String(row.actualCost)
        : ""
    );
    setEditCostOpen(true);
  }

  function handleSaveAdminCost() {
    if (!editCostTarget) return;
    const raw = editCostValue.trim();
    if (raw === "") {
      toast.error("请输入实际金额");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("金额无效");
      return;
    }
    startEditCostTransition(async () => {
      try {
        await updatePurchaseActualCostAction(editCostTarget.id, n);
        toast.success("金额补录成功");
        setEditCostOpen(false);
        setEditCostTarget(null);
        setEditCostValue("");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存失败";
        toast.error(msg === "Unauthorized" ? "无权限执行此操作" : msg);
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

  function handleBatchContract(rows: PurchaseRequest[]) {
    setBatchContractIds(rows.map((row) => row.id));
  }

  function handleBatchPayment(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    if (rows.some((row) => row.paymentStatus !== "UNPAID")) {
      toast.error("只能选择未进入资金流程的单据发起合并请款。");
      return;
    }
    if (resolveBatchPaymentMode(rows) === "mixed") {
      toast.error("不能混选采购垫付和对公结算单据，请分开请款。");
      return;
    }
    setBatchPaymentRows(rows);
  }

  function handleBatchReimbursement(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    if (
      rows.some(
        (row) =>
          row.settlementType !== "采购垫付" ||
          LOCKED_PAYMENT_STATUSES.includes(row.paymentStatus)
      )
    ) {
      toast.error("只能选择未进入资金流程的采购垫付单据发起报销。");
      return;
    }
    setReimbursementRows(rows);
  }

  function handleBatchPaymentSuccess() {
    tableRef.current?.resetRowSelection();
    router.refresh();
  }

  function handleBatchReimbursementSuccess() {
    tableRef.current?.resetRowSelection();
    router.refresh();
  }

  function handleConfirmBatchPayment(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    const isPublicPayment = rowsEveryPaymentStatus(
      rows,
      PUBLIC_PAYMENT_PENDING_STATUSES
    );
    const isReimbursement = rowsEveryPaymentStatus(
      rows,
      REIMBURSEMENT_PENDING_STATUSES
    );
    if (!isPublicPayment && !isReimbursement) {
      toast.error("请只选择同一类待审批单据：对公打款或个人报销，不能混选。");
      return;
    }
    if (
      !confirm(
        isReimbursement
          ? "确认批准该批次采购垫付报销吗？"
          : "确认批准该批次向供方打款吗？"
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await approveBatchPaymentAction(rows.map((row) => row.id));
        toast.success(
          isReimbursement
            ? `已批准 ${rows.length} 单报销`
            : `已批准 ${rows.length} 单打款`
        );
        tableRef.current?.resetRowSelection();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "批准失败");
      }
    });
  }

  function handleFinanceConfirmPayment(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    const isPublicPayment = rowsEveryPaymentStatus(
      rows,
      PUBLIC_PAYMENT_APPROVED_STATUSES
    );
    const isReimbursement = rowsEveryPaymentStatus(
      rows,
      REIMBURSEMENT_APPROVED_STATUSES
    );
    if (!isPublicPayment && !isReimbursement) {
      toast.error("请只选择同一类待财务处理单据：对公打款或个人报销，不能混选已完成记录。");
      return;
    }
    if (
      !confirm(
        isReimbursement
          ? "确认财务已完成该批次报销打款吗？"
          : "确认财务已完成该批次打款吗？"
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await financeConfirmPaymentAction(rows.map((row) => row.id));
        toast.success(
          isReimbursement
            ? `已确认 ${rows.length} 单报销打款完成`
            : `已确认 ${rows.length} 单财务打款完成`
        );
        tableRef.current?.resetRowSelection();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "财务确认失败");
      }
    });
  }

  function handleBatchApprove(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    if (rows.some((row) => row.status !== "PENDING")) {
      toast.error("仅待审批单据可批量同意，请刷新后重试。");
      return;
    }
    startTransition(async () => {
      try {
        await batchApprovePurchasesAction(rows.map((row) => row.id));
        toast.success(`已批量同意 ${rows.length} 张请购单`);
        tableRef.current?.resetRowSelection();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "批量同意失败");
      }
    });
  }

  function handleBatchReject(rows: PurchaseRequest[]) {
    if (!rows.length) return;
    if (rows.some((row) => row.status !== "PENDING")) {
      toast.error("仅待审批单据可批量驳回，请刷新后重试。");
      return;
    }
    const reason = prompt("请输入批量驳回原因（可留空）：") ?? "";
    startTransition(async () => {
      try {
        await batchRejectPurchasesAction(
          rows.map((row) => row.id),
          reason
        );
        toast.success(`已批量驳回 ${rows.length} 张请购单`);
        tableRef.current?.resetRowSelection();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "批量驳回失败");
      }
    });
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
    onMarkAsPaid: handleMarkAsPaid,
    onEditInvoice: handleEditInvoice,
    onPrintContract: handlePrintContract,
    onAdminEditCost: handleAdminEditCost,
    onEditSupplier: handleEditSupplier,
    onReturnPurchase: handleReturnPurchase,
    onConfirmRefund: handleConfirmRefund,
    requestNoExpandedAll,
    requestNoCollapseSignal,
    supplierNameExpandedAll,
  });

  return (
    <>
      <div className="mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">物品采购审批</h1>
          <p className="mt-1 text-sm text-slate-500">
            申请 → 审批 → 采购 → 入库，入库自动同步总仓库存
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        tableRef={tableRef}
        globalActions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setRequestNoExpandedAll(true)}
            >
              <ChevronsRight className="mr-1.5 h-4 w-4" />
              单号全部显示
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setRequestNoExpandedAll(false);
                setRequestNoCollapseSignal((value) => value + 1);
              }}
            >
              <ChevronsLeft className="mr-1.5 h-4 w-4" />
              单号全部隐藏
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setSupplierNameExpandedAll(true)}
            >
              <Eye className="mr-1.5 h-4 w-4" />
              供应商全部显示
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setSupplierNameExpandedAll(false)}
            >
              <EyeOff className="mr-1.5 h-4 w-4" />
              供应商全部隐藏
            </Button>
            <Button variant="outline" type="button" onClick={handleExportExcel}>
              <Download className="mr-1.5 h-4 w-4" />
              导出当前数据
            </Button>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              新建请购
            </Button>
          </div>
        }
        onBatchApprove={
          role === "BOSS" || role === "ADMIN" ? handleBatchApprove : undefined
        }
        onBatchReject={
          role === "BOSS" || role === "ADMIN" ? handleBatchReject : undefined
        }
        onBatchContract={handleBatchContract}
        onBatchPayment={handleBatchPayment}
        onBatchReimbursement={handleBatchReimbursement}
        onApproveBatchPayment={
          role === "BOSS" || role === "ADMIN"
            ? handleConfirmBatchPayment
            : undefined
        }
        onFinanceConfirmPayment={
          role === "ADMIN" || role === "BOSS" || role === "PURCHASER"
            ? handleFinanceConfirmPayment
            : undefined
        }
      />

      <CreatePurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <BatchContractModal
        selectedIds={batchContractIds}
        onClose={() => setBatchContractIds([])}
      />

      <BatchPaymentModal
        selectedIds={batchPaymentRows.map((row) => row.id)}
        detailTotalAmount={calculatePaymentAmountTotal(batchPaymentRows)}
        initialSettlementType={resolveBatchPaymentInitialSettlementType(
          batchPaymentRows
        )}
        allowAdvancePayment={
          resolveBatchPaymentMode(batchPaymentRows) === "advance"
        }
        onClose={() => setBatchPaymentRows([])}
        onSuccess={handleBatchPaymentSuccess}
      />

      <ReimbursementModal
        selectedIds={reimbursementRows.map((row) => row.id)}
        detailTotalAmount={calculatePaymentAmountTotal(reimbursementRows)}
        onClose={() => setReimbursementRows([])}
        onSuccess={handleBatchReimbursementSuccess}
      />

      <EditSupplierModal
        purchase={editSupplierTarget}
        onClose={() => setEditSupplierTarget(null)}
      />

      <MarkOrderedDialog
        open={markOrderedOpen}
        onOpenChange={(open) => {
          setMarkOrderedOpen(open);
          if (!open) setMarkOrderedTarget(null);
        }}
        purchase={markOrderedTarget}
      />

      <Dialog
        open={editCostOpen}
        onOpenChange={(open) => {
          setEditCostOpen(open);
          if (!open) {
            setEditCostTarget(null);
            setEditCostValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>补录/修改实际金额</DialogTitle>
            <DialogDescription>
              {editCostTarget
                ? `仅更新「实际金额」字段，不改变审批与采购状态（单号 ${editCostTarget.requestNo}）。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-actual-cost">实际金额（元）</Label>
            <Input
              id="admin-actual-cost"
              type="number"
              step="0.01"
              min={0}
              placeholder={
                editCostTarget
                  ? `预估参考 ¥${editCostTarget.estimatedCost.toFixed(2)}`
                  : ""
              }
              value={editCostValue}
              onChange={(e) => setEditCostValue(e.target.value)}
              disabled={editCostPending}
            />
          </div>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditCostOpen(false)}
              disabled={editCostPending}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSaveAdminCost}
              disabled={editCostPending}
            >
              {editCostPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invoiceOpen}
        onOpenChange={(open) => {
          setInvoiceOpen(open);
          if (!open) {
            setInvoiceTarget(null);
            setInvoiceValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>录入/修改发票</DialogTitle>
            <DialogDescription>
              {invoiceTarget
                ? `请购单号 ${invoiceTarget.requestNo}，保存后仅更新发票号字段。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invoice-no">发票号码</Label>
            <Input
              id="invoice-no"
              type="text"
              placeholder="请输入发票号，可留空清除"
              value={invoiceValue}
              onChange={(e) => setInvoiceValue(e.target.value)}
              disabled={invoicePending}
            />
          </div>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvoiceOpen(false)}
              disabled={invoicePending}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSaveInvoice}
              disabled={invoicePending}
            >
              {invoicePending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open);
          if (!open) {
            setReturnTarget(null);
            setReturnReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>登记退货</DialogTitle>
            <DialogDescription>
              {returnTarget
                ? `采购单 ${returnTarget.requestNo}，退货后采购状态将变更为“已退货”。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {returnTarget?.paymentStatus === "PAID" && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              该单据已付款，登记退货后付款状态会进入“待退款”，请财务后续确认退款到账。
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="return-reason">退货原因</Label>
            <Textarea
              id="return-reason"
              placeholder="请填写退货原因，例如质量问题、型号不符、供应商取消等…"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              className="min-h-[100px] resize-y"
              disabled={returnPending}
            />
          </div>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnOpen(false)}
              disabled={returnPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReturnPurchase}
              disabled={returnPending}
            >
              {returnPending ? "登记中…" : "确认退货"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
