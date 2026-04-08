"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BomItem, Product, Customer } from "@prisma/client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Plug, Link2, Sparkles, Trash2 } from "lucide-react";
import { updateBomItemJig, autoMatchBomJigs } from "@/lib/actions/bom";
import { deleteConnector } from "@/lib/actions/deleteActions";
import { toast } from "sonner";

interface BomClientProps {
  product: Product & { customer: Customer };
  bomItems: BomItem[];
  jigModels: string[];
  isAdmin: boolean;
}

export function BomClient({
  product,
  bomItems,
  jigModels,
  isAdmin,
}: BomClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [connectorToDelete, setConnectorToDelete] = useState<{
    id: string;
    model: string;
  } | null>(null);

  function handleJigChange(bomItemId: string, value: string | null) {
    const v = value ?? "__none__";
    const jigModel = v === "__none__" ? null : v;
    startTransition(async () => {
      try {
        await updateBomItemJig(bomItemId, jigModel);
        toast.success("治具匹配已保存");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handleAutoMatch() {
    startTransition(async () => {
      try {
        const result = await autoMatchBomJigs(product.id);
        if (result.matched === 0) {
          toast.info("未找到可自动匹配的治具，请检查总仓对插型号数据");
        } else {
          toast.success(
            `智能匹配完成：${result.matched} / ${result.total} 项已自动绑定`
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "匹配失败");
      }
    });
  }

  const unmatchedCount = bomItems.filter((b) => !b.jigModel).length;

  function handleConfirmDeleteConnector() {
    if (!connectorToDelete) return;
    startDeleteTransition(async () => {
      try {
        await deleteConnector(connectorToDelete.id);
        toast.success("已删除连接器明细");
        setConnectorToDelete(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/customers"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回客户列表
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">BOM 维护清单</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>客户：{product.customer.name}</span>
              <span className="text-slate-300">|</span>
              <span>产品规格：</span>
              <Badge variant="secondary">{product.code}</Badge>
            </div>
          </div>
          {bomItems.length > 0 && unmatchedCount > 0 && (
            <Button
              variant="outline"
              onClick={handleAutoMatch}
              disabled={isPending}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {isPending ? "匹配中…" : "一键智能匹配"}
            </Button>
          )}
        </div>
      </div>

      {bomItems.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          <div className="text-center">
            <Plug className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">
              该产品暂无连接器数据，请通过智能导入 BOM 添加
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>连接器型号</TableHead>
                <TableHead className="w-24">数量</TableHead>
                <TableHead>匹配治具</TableHead>
                {isAdmin && (
                  <TableHead className="w-20 text-right">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-slate-400">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Plug className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-sm font-medium text-slate-800">
                        {item.connectorModel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="tabular-nums">
                      {item.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <Select
                        key={`${item.id}-${item.jigModel ?? "empty"}`}
                        value={item.jigModel ?? "__none__"}
                        onValueChange={(val) => handleJigChange(item.id, val)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="请选择治具" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              未匹配
                            </span>
                          </SelectItem>
                          {jigModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="删除此连接器行"
                        disabled={isPending || deletePending}
                        onClick={() =>
                          setConnectorToDelete({
                            id: item.id,
                            model: item.connectorModel,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!connectorToDelete}
        onOpenChange={(open) => {
          if (!open) setConnectorToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗？此操作不可逆</AlertDialogTitle>
            <AlertDialogDescription>
              {connectorToDelete
                ? `将永久删除连接器「${connectorToDelete.model}」在本 BOM 中的记录。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePending}
              onClick={() => setConnectorToDelete(null)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={handleConfirmDeleteConnector}
            >
              {deletePending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 text-xs text-slate-400">
        共 {bomItems.length} 项连接器 · 已匹配{" "}
        {bomItems.filter((b) => b.jigModel).length} 项
        {unmatchedCount > 0 && (
          <span className="text-amber-500"> · {unmatchedCount} 项待匹配</span>
        )}
      </p>
    </div>
  );
}
