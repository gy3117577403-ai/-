"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseRequest } from "@prisma/client";
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
import { updateSupplierInfoAction } from "@/lib/actions/purchase";
import { toast } from "sonner";

type EditSupplierModalProps = {
  purchase: PurchaseRequest | null;
  onClose: () => void;
};

export function EditSupplierModal({
  purchase,
  onClose,
}: EditSupplierModalProps) {
  return (
    <Dialog open={Boolean(purchase)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        {purchase && (
          <EditSupplierForm
            key={purchase.id}
            purchase={purchase}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditSupplierForm({
  purchase,
  onClose,
}: {
  purchase: PurchaseRequest;
  onClose: () => void;
}) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState(purchase.supplierName ?? "");
  const [supplierAccount, setSupplierAccount] = useState(
    purchase.supplierAccount ?? ""
  );
  const [supplierBank, setSupplierBank] = useState(purchase.supplierBank ?? "");
  const [isPending, startTransition] = useTransition();

  const canSubmit = Boolean(purchase && supplierName.trim());

  function handleSubmit() {
    if (!purchase || !canSubmit) return;

    startTransition(async () => {
      try {
        await updateSupplierInfoAction(purchase.id, {
          supplierName,
          supplierAccount,
          supplierBank,
        });
        toast.success("供应商信息已更新");
        onClose();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保存供应商信息失败");
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>编辑供应商信息</DialogTitle>
        <DialogDescription>
          采购单 {purchase.requestNo}，已付款单据将被系统锁定不可编辑。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-supplier-name">供应商名称</Label>
          <Input
            id="edit-supplier-name"
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            placeholder="请输入供应商名称"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-supplier-account">对公账号</Label>
          <Input
            id="edit-supplier-account"
            value={supplierAccount}
            onChange={(event) => setSupplierAccount(event.target.value)}
            placeholder="请输入对公账号"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-supplier-bank">开户行</Label>
          <Input
            id="edit-supplier-bank"
            value={supplierBank}
            onChange={(event) => setSupplierBank(event.target.value)}
            placeholder="请输入开户行"
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
          {isPending ? "保存中..." : "保存"}
        </Button>
      </DialogFooter>
    </>
  );
}
