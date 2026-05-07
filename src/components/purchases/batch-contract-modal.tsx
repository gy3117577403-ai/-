"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
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

type BatchContractModalProps = {
  selectedIds: string[];
  onClose: () => void;
};

export function BatchContractModal({
  selectedIds,
  onClose,
}: BatchContractModalProps) {
  const [supplierName, setSupplierName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");

  const canSubmit = selectedIds.length > 0 && supplierName.trim().length > 0;

  function handleGenerate() {
    if (!canSubmit) return;

    const params = new URLSearchParams({
      ids: selectedIds.join(","),
      supplierName: supplierName.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
    });

    window.open(
      `/print/contract/batch?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
    onClose();
  }

  return (
    <Dialog open={selectedIds.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>生成合并合同</DialogTitle>
          <DialogDescription>
            已选择 {selectedIds.length} 条采购记录，请填写供方信息。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-supplier-name">供方/客户名称</Label>
            <Input
              id="batch-supplier-name"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="请输入供方/客户名称"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-contact">联系人</Label>
            <Input
              id="batch-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="请输入联系人"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-phone">联系电话</Label>
            <Input
              id="batch-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="请输入联系电话"
            />
          </div>
        </div>

        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={!canSubmit}>
            <FileText className="mr-1.5 h-4 w-4" />
            生成合同
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
