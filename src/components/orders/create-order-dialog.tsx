"use client";

import { useEffect, useState, useTransition } from "react";
import type { Customer } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createOrder } from "@/lib/actions/order";
import { toast } from "sonner";

type CustomerWithProducts = Customer & {
  products: { id: string; code: string; name: string }[];
};

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerWithProducts[];
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  customers,
}: CreateOrderDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<string>("existing");

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");

  const [newCustomerName, setNewCustomerName] = useState("");
  const [newProductCode, setNewProductCode] = useState("");

  const [plannedQty, setPlannedQty] = useState("");
  const [operator, setOperator] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const products = selectedCustomer?.products ?? [];

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setTab("existing");
      setCustomerId("");
      setProductId("");
      setNewCustomerName("");
      setNewProductCode("");
      setPlannedQty("");
      setOperator("");
    });
  }, [open]);

  function handleSubmit() {
    const qty = parseInt(plannedQty, 10);
    if (!qty || qty < 1) {
      toast.error("计划产量必须为正整数");
      return;
    }
    if (!operator.trim()) {
      toast.error("请填写操作员姓名");
      return;
    }

    if (tab === "existing" && !productId) {
      toast.error("请选择产品");
      return;
    }
    if (tab === "new") {
      if (!newCustomerName.trim()) {
        toast.error("请填写客户名称");
        return;
      }
      if (!newProductCode.trim()) {
        toast.error("请填写产品规格");
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await createOrder({
          mode: tab as "existing" | "new",
          productId: tab === "existing" ? productId : undefined,
          newCustomerName: tab === "new" ? newCustomerName : undefined,
          newProductCode: tab === "new" ? newProductCode : undefined,
          plannedQty: qty,
          operator,
        });

        if (result.status === "READY") {
          toast.success("开工记录已创建，齐套性校验通过");
        } else if (result.status === "SHORTAGE") {
          toast.warning("开工记录已创建，但存在治具缺口，请尽快采购", {
            duration: 6000,
          });
        } else {
          toast.info("开工记录已创建，该产品暂无 BOM，待工程配置");
        }
        onOpenChange(false);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "创建失败",
          { duration: 8000 }
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建开工记录</DialogTitle>
          <DialogDescription>
            选择已有产品或快捷新建，系统将自动校验齐套性
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="existing">选择已有产品</TabsTrigger>
            <TabsTrigger value="new">快捷新建产品</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>客户</Label>
              <Select
                value={customerId}
                onValueChange={(v) => {
                  setCustomerId(v ?? "");
                  setProductId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择客户" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>产品规格</Label>
              <Select
                value={productId}
                onValueChange={(v) => setProductId(v ?? "")}
                disabled={!customerId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={customerId ? "请选择产品" : "请先选择客户"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newCustomer">客户名称</Label>
              <Input
                id="newCustomer"
                placeholder="例: 新客户有限公司"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newProduct">产品规格 / 型号</Label>
              <Input
                id="newProduct"
                placeholder="例: XYZ-2026-NEW"
                value={newProductCode}
                onChange={(e) => setNewProductCode(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* 公共字段 */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="plannedQty">计划产量</Label>
            <Input
              id="plannedQty"
              type="number"
              min={1}
              placeholder="例: 500"
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="operator">操作员</Label>
            <Input
              id="operator"
              placeholder="请输入操作员姓名"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "校验中…" : "提交开工"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
