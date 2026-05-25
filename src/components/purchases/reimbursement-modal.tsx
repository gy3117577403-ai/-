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
  getHistoricalReimbursementInfoAction,
  getHistoricalReimbursementNamesAction,
  submitBatchReimbursementAction,
} from "@/lib/actions/purchase";
import { toast } from "sonner";

type ReimbursementModalProps = {
  selectedIds: string[];
  detailTotalAmount: number;
  onClose: () => void;
  onSuccess: () => void;
};

type AutoFilledInfo = {
  name: string;
  card: string;
  bank: string;
} | null;

export function ReimbursementModal({
  selectedIds,
  detailTotalAmount,
  onClose,
  onSuccess,
}: ReimbursementModalProps) {
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [bank, setBank] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLookupPending, startLookupTransition] = useTransition();
  const autoFilledRef = useRef<AutoFilledInfo>(null);
  const cardRef = useRef("");
  const bankRef = useRef("");

  const canSubmit = Boolean(
    selectedIds.length > 0 &&
      name.trim() &&
      card.trim() &&
      bank.trim() &&
      Number.isFinite(Number(confirmedAmount)) &&
      Number(confirmedAmount) > 0
  );
  const normalizedDetailTotal = Math.round(detailTotalAmount * 100) / 100;
  const normalizedConfirmedAmount = Number.isFinite(Number(confirmedAmount))
    ? Math.round(Number(confirmedAmount) * 100) / 100
    : 0;
  const amountMismatch =
    normalizedConfirmedAmount > 0 &&
    Math.abs(normalizedConfirmedAmount - normalizedDetailTotal) >= 0.01;

  useEffect(() => {
    if (!selectedIds.length) return;

    startLookupTransition(async () => {
      try {
        const history = await getHistoricalReimbursementNamesAction();
        setNames(history);
      } catch {
        setNames([]);
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
    cardRef.current = card;
  }, [card]);

  useEffect(() => {
    bankRef.current = bank;
  }, [bank]);

  useEffect(() => {
    const reimbursementName = name.trim();
    if (!reimbursementName) return;

    const timer = window.setTimeout(() => {
      startLookupTransition(async () => {
        try {
          const info = await getHistoricalReimbursementInfoAction(
            reimbursementName
          );
          if (!info) return;

          const previous = autoFilledRef.current;
          const canReplaceCard =
            !cardRef.current.trim() || cardRef.current === previous?.card;
          const canReplaceBank =
            !bankRef.current.trim() || bankRef.current === previous?.bank;

          if (canReplaceCard) setCard(info.card);
          if (canReplaceBank) setBank(info.bank);

          autoFilledRef.current = {
            name: reimbursementName,
            card: info.card,
            bank: info.bank,
          };

          if (canReplaceCard || canReplaceBank) {
            toast.success("已自动带出历史报销账户信息");
          }
        } catch {
          // Historical lookup is a convenience and should not block entry.
        }
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [name]);

  function handleSubmit() {
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        await submitBatchReimbursementAction(selectedIds, {
          name,
          card,
          bank,
          confirmedAmount: normalizedConfirmedAmount,
        });
        toast.success(`已发起 ${selectedIds.length} 单合并报销`);
        onSuccess();
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "报销提交失败");
      }
    });
  }

  return (
    <Dialog open={selectedIds.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>申请合并报销</DialogTitle>
          <DialogDescription>
            已选择 {selectedIds.length} 张采购垫付单据，提交后将发送老板报销审批通知。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reimbursement-name">报销收款人</Label>
            <Input
              id="reimbursement-name"
              list="reimbursement-name-list"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入收款人姓名"
              disabled={isPending}
            />
            <datalist id="reimbursement-name-list">
              {names.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {isLookupPending && (
              <p className="text-xs text-slate-400">正在查询历史报销账户信息...</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reimbursement-card">银行卡号</Label>
            <Input
              id="reimbursement-card"
              inputMode="numeric"
              value={card}
              onChange={(event) => setCard(event.target.value)}
              placeholder="请输入银行卡号"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reimbursement-bank">开户行</Label>
            <Input
              id="reimbursement-bank"
              value={bank}
              onChange={(event) => setBank(event.target.value)}
              placeholder="请输入开户行"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>明细自动合计金额</Label>
              <div className="flex h-9 items-center rounded-md border bg-slate-50 px-3 text-sm font-medium tabular-nums text-slate-700">
                ￥{normalizedDetailTotal.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reimbursement-confirmed-amount">
                确认报销金额
              </Label>
              <Input
                id="reimbursement-confirmed-amount"
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
              确认金额与明细合计不一致，请核对后提交。
            </div>
          )}
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
            {isPending ? "提交中..." : "提交报销"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
