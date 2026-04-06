"use client";

import { useState, useTransition } from "react";
import type { Customer, Product } from "@prisma/client";
import { SmartImportButton } from "@/components/bom/smart-import-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Plus, Building2, Package, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createCustomer } from "@/lib/actions/customer";
import { toast } from "sonner";
import { format } from "date-fns";

type CustomerWithProducts = Customer & {
  products: (Product & { _count: { bomItems: number } })[];
};

export function CustomersClient({ data }: { data: CustomerWithProducts[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreate() {
    if (!code.trim() || !name.trim()) {
      toast.error("客户编码和名称不能为空");
      return;
    }
    startTransition(async () => {
      try {
        await createCustomer({ code: code.trim(), name: name.trim() });
        toast.success("客户创建成功");
        setDialogOpen(false);
        setCode("");
        setName("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">客户与产品管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理客户、产品规格及 BOM 明细数据
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SmartImportButton />
          <Button
            onClick={() => {
              setCode("");
              setName("");
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            新增客户
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          <div className="text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-400">
              暂无客户数据，点击上方「智能导入 BOM」快速录入
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((customer) => (
            <div
              key={customer.id}
              className="rounded-lg border bg-white shadow-sm"
            >
              {/* 客户行 */}
              <button
                type="button"
                onClick={() => toggleExpand(customer.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <ChevronRight
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    expanded.has(customer.id) ? "rotate-90" : ""
                  }`}
                />
                <Building2 className="h-4 w-4 text-slate-500" />
                <div className="flex-1">
                  <span className="font-medium text-slate-800">
                    {customer.name}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {customer.code}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {customer.products.length} 款产品
                </Badge>
                <span className="text-xs text-slate-400">
                  {format(new Date(customer.createdAt), "yyyy-MM-dd")}
                </span>
              </button>

              {/* 产品展开区 */}
              {expanded.has(customer.id) && customer.products.length > 0 && (
                <div className="border-t bg-slate-50/50 px-5 pb-3 pt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>产品规格</TableHead>
                        <TableHead>BOM 条目数</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-mono text-sm">
                                {product.code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product._count.bomItems} 项
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {format(
                              new Date(product.createdAt),
                              "yyyy-MM-dd HH:mm"
                            )}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/products/${product.id}/bom`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              维护 BOM
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {expanded.has(customer.id) && customer.products.length === 0 && (
                <div className="border-t px-5 py-4 text-center text-sm text-slate-400">
                  该客户暂无产品数据
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 新增客户弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新增客户</DialogTitle>
            <DialogDescription>录入新的客户信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-code">客户编码</Label>
              <Input
                id="customer-code"
                placeholder="例: CUST-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-name">客户名称</Label>
              <Input
                id="customer-name"
                placeholder="例: 华为技术有限公司"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
