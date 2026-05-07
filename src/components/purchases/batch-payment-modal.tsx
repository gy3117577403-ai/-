"use client";

import { useState, useTransition } from "react";
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
import { createBatchPaymentRequest } from "@/lib/actions/purchase";
import { toast } from "sonner";

type BatchPaymentModalProps = {
  selectedIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export function BatchPaymentModal({
  selectedIds,
  onClose,
  onSuccess,
}: BatchPaymentModalProps) {
  const [settlementType, setSettlementType] = useState("月结");
  const [supplierName, setSupplierName] = useState("");
  const [supplierAccount, setSupplierAccount] = useState("");
  const [supplierBank, setSupplierBank] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    selectedIds.length > 0 &&
    settlementType.trim() &&
    supplierName.trim() &&
    supplierAccount.trim() &&
    supplierBank.trim();

  function handleSubmit() {
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        await createBatchPaymentRequest(selectedIds, {
          settlementType,
          supplierName,
          supplierAccount,
          supplierBank,
        });
        toast.success(`已发起 ${selectedIds.length} 单合并请款`);
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
            已选择 {selectedIds.length} 张采购单，提交后将发送一条财务打款审批通知。
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
                <SelectItem value="月结">月结</SelectItem>
                <SelectItem value="对公现结">对公现结</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-payment-supplier">供方名称</Label>
            <Input
              id="batch-payment-supplier"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="请输入供应商名称"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-payment-account">对公账号</Label>
            <Input
              id="batch-payment-account"
              value={supplierAccount}
              onChange={(event) => setSupplierAccount(event.target.value)}
              placeholder="请输入供方对公账号"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-payment-bank">开户行</Label>
            <Input
              id="batch-payment-bank"
              value={supplierBank}
              onChange={(event) => setSupplierBank(event.target.value)}
              placeholder="请输入供方开户行"
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
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "提交中..." : "提交请款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
