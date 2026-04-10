"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import type { Customer, Product } from "@prisma/client";
import { useRouter } from "next/navigation";
import { SmartImportButton } from "@/components/bom/smart-import-button";
import { BulkBomImportDialog } from "@/components/bom/bulk-bom-import-dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Building2,
  Package,
  ChevronRight,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createCustomer } from "@/lib/actions/customer";
import { deleteCustomer, deleteProduct } from "@/lib/actions/deleteActions";
import { globalSmartMatchFixturesAction } from "@/lib/actions/bom";
import { toast } from "sonner";
import { formatInShanghai } from "@/lib/dayjs-shanghai";
import { SHORTAGE_UNMATCHED_JIG_PREFIX } from "@/lib/order-constants";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

type CustomerWithProducts = Customer & {
  products: (Product & {
    _count: { bomItems: number };
    bomUnmatchedCount: number;
    bomUnmatchedConnectors: string[];
  })[];
};

type DeleteTarget =
  | { type: "customer"; id: string; label: string }
  | { type: "product"; id: string; label: string };

export function CustomersClient({
  data,
  isAdmin,
}: {
  data: CustomerWithProducts[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [globalMatchPending, startGlobalMatch] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const expandedCustomerIds = useUiStore((s) => s.expandedCustomerIds);
  const toggleExpandedCustomer = useUiStore((s) => s.toggleExpandedCustomer);
  const customerSearchTerm = useUiStore((s) => s.customerSearchTerm);
  const setCustomerSearchTerm = useUiStore((s) => s.setCustomerSearchTerm);
  const mergeExpandedCustomerIds = useUiStore((s) => s.mergeExpandedCustomerIds);

  const prevSearchTokenRef = useRef("");

  const searchLower = customerSearchTerm.trim().toLowerCase();

  const visibleCustomers = useMemo(() => {
    return data
      .map((c) => ({
        ...c,
        products: c.products.filter((p) =>
          searchLower === "" ? true : p.code.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((c) => searchLower === "" || c.products.length > 0);
  }, [data, searchLower]);

  useEffect(() => {
    const t = customerSearchTerm.trim().toLowerCase();
    if (!t || t === prevSearchTokenRef.current) {
      prevSearchTokenRef.current = t;
      return;
    }
    const ids = data
      .filter((c) =>
        c.products.some((p) => p.code.toLowerCase().includes(t))
      )
      .map((c) => c.id);
    if (ids.length) mergeExpandedCustomerIds(ids);
    prevSearchTokenRef.current = t;
  }, [customerSearchTerm, data, mergeExpandedCustomerIds]);

  function handleGlobalSmartMatch() {
    startGlobalMatch(async () => {
      try {
        const res = await globalSmartMatchFixturesAction();
        toast.success(
          `全局匹配完成：更新 ${res.updatedItems} 条 BOM，涉及 ${res.affectedProducts} 个产品；已同步工单 ${res.ordersReconciled} 条`
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "全局匹配失败");
      }
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

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      try {
        if (deleteTarget.type === "customer") {
          await deleteCustomer(deleteTarget.id);
        } else {
          await deleteProduct(deleteTarget.id);
        }
        toast.success("删除成功");
        setDeleteTarget(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">客户与产品管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理客户、产品规格及 BOM 明细数据
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleGlobalSmartMatch}
            disabled={globalMatchPending}
            title="按总仓对插型号规则，为全库未匹配的 BOM 行写入治具型号"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {globalMatchPending ? "匹配中…" : "一键全局智能匹配治具"}
          </Button>
          <SmartImportButton />
          <BulkBomImportDialog />
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

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索产品规格（全局过滤，状态会保留）"
            value={customerSearchTerm}
            onChange={(e) => setCustomerSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="按产品规格搜索"
          />
        </div>
        {searchLower !== "" && (
          <p className="text-xs text-slate-500">
            已过滤 {visibleCustomers.length} 个含匹配规格的客户
          </p>
        )}
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
          {visibleCustomers.map((customer) => {
            const isExpanded = expandedCustomerIds.includes(customer.id);
            return (
            <div
              key={customer.id}
              className="rounded-lg border bg-white shadow-sm"
            >
              {/* 客户行 */}
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => toggleExpandedCustomer(customer.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800">
                      {customer.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {customer.code}
                    </span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {customer.products.length} 款产品
                  </Badge>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatInShanghai(customer.createdAt, "YYYY-MM-DD")}
                  </span>
                </button>
                {isAdmin && (
                  <div className="flex items-center border-l border-slate-100 pr-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="删除客户"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({
                          type: "customer",
                          id: customer.id,
                          label: customer.name,
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* 产品展开区 */}
              {isExpanded && customer.products.length > 0 && (
                <div className="border-t bg-slate-50/50 px-5 pb-3 pt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>产品规格</TableHead>
                        <TableHead>治具状态</TableHead>
                        <TableHead>BOM 条目数</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.products.map((product) => {
                        const bomTotal = product._count.bomItems;
                        const unmatched = product.bomUnmatchedCount;
                        const allMatched =
                          bomTotal > 0 && unmatched === 0;
                        const hasGap = unmatched > 0;
                        const preview = product.bomUnmatchedConnectors.slice(0, 4);
                        const more =
                          product.bomUnmatchedConnectors.length - preview.length;

                        return (
                        <TableRow
                          key={product.id}
                          className={cn(
                            allMatched &&
                              "bg-emerald-50/90 border-l-4 border-l-emerald-500",
                            hasGap &&
                              "bg-red-50/90 border-l-4 border-l-red-500"
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  hasGap
                                    ? "text-red-500"
                                    : allMatched
                                      ? "text-emerald-600"
                                      : "text-slate-400"
                                )}
                              />
                              <span
                                className={cn(
                                  "font-mono text-sm",
                                  hasGap && "font-semibold text-red-800"
                                )}
                              >
                                {product.code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {bomTotal === 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                无 BOM
                              </Badge>
                            ) : allMatched ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                已齐套
                              </span>
                            ) : (
                              <div className="max-w-[280px] space-y-1">
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  缺治具匹配
                                </span>
                                <p
                                  className="text-xs leading-snug text-red-600/90"
                                  title={product.bomUnmatchedConnectors.join(
                                    ", "
                                  )}
                                >
                                  {SHORTAGE_UNMATCHED_JIG_PREFIX}{" "}
                                  {preview.join(", ")}
                                  {more > 0 ? ` 等${more}项` : ""}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product._count.bomItems} 项
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatInShanghai(
                              product.createdAt,
                              "YYYY-MM-DD HH:mm"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/products/${product.id}/bom`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                              >
                                维护 BOM
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              {isAdmin && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  title="删除产品"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "product",
                                      id: product.id,
                                      label: product.code,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {isExpanded && customer.products.length === 0 && (
                <div className="border-t px-5 py-4 text-center text-sm text-slate-400">
                  {searchLower !== ""
                    ? "无符合当前搜索的产品规格"
                    : "该客户暂无产品数据"}
                </div>
              )}
            </div>
            );
          })}
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗？此操作不可逆</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "customer"
                ? `将删除客户「${deleteTarget.label}」及其下全部产品与 BOM 明细。请确认无业务依赖后再操作。`
                : deleteTarget?.type === "product"
                  ? `将删除产品「${deleteTarget.label}」及其全部 BOM 连接器明细。`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePending}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={handleConfirmDelete}
            >
              {deletePending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
