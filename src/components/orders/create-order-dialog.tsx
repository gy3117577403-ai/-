"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createOrder } from "@/lib/actions/order";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type CustomerWithProducts = Customer & {
  products: { id: string; code: string; name: string }[];
};

type ProductOption = { id: string; code: string; name: string };

/** 客户：仅展示 name/code，绑定 id，绝不展示 CUID */
function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: CustomerWithProducts[];
  value: string;
  onChange: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal shadow-none hover:bg-transparent"
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? (
            <>
              <span className="font-medium">{selected.name}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-mono text-xs text-slate-600">
                {selected.code}
              </span>
            </>
          ) : (
            "请选择客户"
          )}
        </span>
        <ChevronDown className="ml-1 size-4 shrink-0 text-muted-foreground" />
      </Button>
      {open && (
        <div
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-foreground/10 bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          role="listbox"
        >
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={value === c.id}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
                value === c.id && "bg-accent"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
            >
              <span className="font-medium leading-tight">{c.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {c.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 产品规格：可输入模糊搜索，选中后回填 productId */
function ProductSpecCombobox({
  products,
  value,
  onChange,
  disabled,
}: {
  products: ProductOption[];
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selected = products.find((p) => p.id === value);

  const q = query.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!q) return true;
    const code = (p.code ?? "").toLowerCase();
    const name = (p.name ?? "").toLowerCase();
    return code.includes(q) || name.includes(q);
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    function onDocMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal shadow-none hover:bg-transparent",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left font-mono text-sm",
            !selected && "font-sans text-muted-foreground"
          )}
        >
          {selected ? selected.code : "请选择产品规格"}
        </span>
        <ChevronDown className="ml-1 size-4 shrink-0 text-muted-foreground" />
      </Button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border border-foreground/10 bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          role="listbox"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              autoComplete="off"
              placeholder="搜索产品规格…"
              value={query}
              className="h-8 pl-8 text-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border/60">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                无匹配规格
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={value === p.id}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border/40 px-2 py-2 text-left last:border-b-0 hover:bg-accent focus:bg-accent focus:outline-none",
                    value === p.id && "bg-accent/80"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <span className="font-mono text-sm font-medium leading-tight">
                    {p.code}
                  </span>
                  {p.name && p.name !== p.code && (
                    <span className="text-xs text-muted-foreground">
                      {p.name}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
              <CustomerPicker
                customers={customers}
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  setProductId("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>产品规格</Label>
              <ProductSpecCombobox
                products={products}
                value={productId}
                onChange={setProductId}
                disabled={!customerId}
              />
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
