"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBatchPaymentRequest,
  getHistoricalSupplierInfoAction,
  getHistoricalSupplierNamesAction,
} from "@/lib/actions/purchase";
import { toast } from "sonner";

type BatchPaymentModalProps = {
  selectedIds: string[];
  detailTotalAmount: number;
  initialSettlementType: string;
  allowAdvancePayment: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type AutoFilledInfo = {
  supplierName: string;
  supplierAccount: string;
  supplierBank: string;
} | null;

export function BatchPaymentModal({
  selectedIds,
  detailTotalAmount,
  initialSettlementType,
  allowAdvancePayment,
  onClose,
  onSuccess,
}: BatchPaymentModalProps) {
  const [settlementType, setSettlementType] = useState("月结");
  const [supplierName, setSupplierName] = useState("");
  const [supplierAccount, setSupplierAccount] = useState("");
  const [supplierBank, setSupplierBank] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLookupPending, startLookupTransition] = useTransition();
  const autoFilledRef = useRef<AutoFilledInfo>(null);
  const supplierAccountRef = useRef("");
  const supplierBankRef = useRef("");

  const canSubmit = Boolean(
    selectedIds.length > 0 &&
      settlementType.trim() &&
      supplierName.trim() &&
      supplierAccount.trim() &&
      supplierBank.trim() &&
      Number.isFinite(Number(confirmedAmount)) &&
      Number(confirmedAmount) > 0
  );
  const isAdvancePayment = allowAdvancePayment && settlementType === "采购垫付";
  const normalizedDetailTotal = Math.round(detailTotalAmount * 100) / 100;
  const normalizedConfirmedAmount = Number.isFinite(Number(confirmedAmount))
    ? Math.round(Number(confirmedAmount) * 100) / 100
    : 0;
  const amountMismatch =
    normalizedConfirmedAmount > 0 &&
    Math.abs(normalizedConfirmedAmount - normalizedDetailTotal) >= 0.01;

  useEffect(() => {
    if (selectedIds.length === 0) return;

    startLookupTransition(async () => {
      try {
        const names = await getHistoricalSupplierNamesAction();
        setSupplierNames(names);
      } catch {
        setSupplierNames([]);
      }
    });
  }, [selectedIds.length]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!selectedIds.length) {
        setConfirmedAmount("");
        return;
      }
      setConfirmedAmount(normalizedDetailTotal > 0 ? normalizedDetailTotal.toFixed(2) : "");
    });
  }, [normalizedDetailTotal, selectedIds.length]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!selectedIds.length) return;
      setSettlementType(initialSettlementType || "月结");
    });
  }, [initialSettlementType, selectedIds.length]);

  useEffect(() => {
    supplierAccountRef.current = supplierAccount;
  }, [supplierAccount]);

  useEffect(() => {
    supplierBankRef.current = supplierBank;
  }, [supplierBank]);

  useEffect(() => {
    const name = supplierName.trim();
    if (isAdvancePayment) return;
    if (!name) return;

    const timer = window.setTimeout(() => {
      startLookupTransition(async () => {
        try {
          const info = await getHistoricalSupplierInfoAction(name);
          if (!info) return;

          const previous = autoFilledRef.current;
          const currentAccount = supplierAccountRef.current;
          const currentBank = supplierBankRef.current;
          const canReplaceAccount =
            !currentAccount.trim() ||
            currentAccount === previous?.supplierAccount;
          const canReplaceBank =
            !currentBank.trim() || currentBank === previous?.supplierBank;

          if (canReplaceAccount) setSupplierAccount(info.supplierAccount);
          if (canReplaceBank) setSupplierBank(info.supplierBank);

          autoFilledRef.current = {
            supplierName: name,
            supplierAccount: info.supplierAccount,
            supplierBank: info.supplierBank,
          };

          if (canReplaceAccount || canReplaceBank) {
            toast.success("已自动带出历史账户信息");
          }
        } catch {
          // Historical lookup is a convenience; never block payment entry.
        }
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isAdvancePayment, supplierName]);

  function handleSubmit() {
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        await createBatchPaymentRequest(selectedIds, {
          settlementType: isAdvancePayment ? "采购垫付" : settlementType,
          supplierName,
          supplierAccount,
          supplierBank,
          confirmedAmount: normalizedConfirmedAmount,
        });
        toast.success(
          isAdvancePayment
            ? `已发起 ${selectedIds.length} 单合并报销`
            : `已发起 ${selectedIds.length} 单合并请款`
        );
        onSuccess();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "请款提交失败");
      }
    });
  }

  return (
    <Dialog open={selectedIds.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>申请合并请款</DialogTitle>
          <DialogDescription>
            已选择 {selectedIds.length} 张采购单，提交后将发送一条
            {allowAdvancePayment ? "垫付报销审批" : "财务打款审批"}通知。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>结算方式</Label>
            <Select
              value={settlementType}
              onValueChange={(value) => setSettlementType(value ?? "月结")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowAdvancePayment ? (
                  <SelectItem value="采购垫付">垫付</SelectItem>
                ) : (
                  <>
                    <SelectItem value="月结">月结</SelectItem>
                    <SelectItem value="对公现结">对公现结</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>订单实际总金额</Label>
              <div className="flex h-9 items-center rounded-md border bg-slate-50 px-3 text-sm font-medium tabular-nums text-slate-700">
                ￥{normalizedDetailTotal.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-payment-confirmed-amount">
                确认请款金额
              </Label>
              <Input
                id="batch-payment-confirmed-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={confirmedAmount}
                onChange={(event) => setConfirmedAmount(event.target.value)}
                onBlur={() => {
                  const amount = Number(confirmedAmount);
                  if (Number.isFinite(amount) && amount > 0) {
                    setConfirmedAmount((Math.round(amount * 100) / 100).toFixed(2));
                  }
                }}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
          </div>

          {amountMismatch && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              确认金额与订单实际总金额不一致，请核对后提交。
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="batch-payment-supplier">
              {isAdvancePayment ? "报销收款人" : "供方名称"}
            </Label>
            <Input
              id="batch-payment-supplier"
              list={isAdvancePayment ? undefined : "batch-payment-supplier-list"}
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder={isAdvancePayment ? "请输入收款人姓名" : "请输入供应商名称"}
              disabled={isPending}
            />
            {!isAdvancePayment && (
              <datalist id="batch-payment-supplier-list">
                {supplierNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
            {!isAdvancePayment && isLookupPending && (
              <p className="text-xs text-slate-400">正在查询历史账户信息...</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-payment-account">
              {isAdvancePayment ? "银行卡号" : "对公账号"}
            </Label>
            <Input
              id="batch-payment-account"
              inputMode={isAdvancePayment ? "numeric" : undefined}
              value={supplierAccount}
              onChange={(event) => setSupplierAccount(event.target.value)}
              placeholder={isAdvancePayment ? "请输入银行卡号" : "请输入供方对公账号"}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-payment-bank">开户行</Label>
            <Input
              id="batch-payment-bank"
              value={supplierBank}
              onChange={(event) => setSupplierBank(event.target.value)}
              placeholder={isAdvancePayment ? "请输入收款人开户行" : "请输入供方开户行"}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? "提交中..." : isAdvancePayment ? "提交报销" : "提交请款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
