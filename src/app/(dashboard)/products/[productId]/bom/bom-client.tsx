"use client";

import { useState, useTransition, useEffect, useMemo, useCallback } from "react";
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
import { ArrowLeft, Plug, Link2, Sparkles, Trash2, Zap } from "lucide-react";
import { BulkBomImportDialog } from "@/components/bom/bulk-bom-import-dialog";
import { JigCreatableCombobox } from "@/components/bom/jig-creatable-combobox";
import {
  bomRowNeedsJigAssignment,
  normalizeJigModelInputForStorage,
} from "@/lib/bom-jig-status";
import { updateBomItemJig, autoMatchBomJigs } from "@/lib/actions/bom";
import { deleteConnector } from "@/lib/actions/deleteActions";
import { toast } from "sonner";

interface BomClientProps {
  product: Product & { customer: Customer };
  bomItems: BomItem[];
  jigModels: string[];
  isAdmin: boolean;
}

function sameJigModel(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = a?.trim() ?? "";
  const y = b?.trim() ?? "";
  return x === y;
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

  /** 与 Creatable Combobox 同步，供 ⚡ 读取当前输入 */
  const [jigDraftByItemId, setJigDraftByItemId] = useState<
    Record<string, string>
  >({});

  const bomSyncKey = useMemo(
    () => bomItems.map((i) => `${i.id}:${i.jigModel ?? ""}`).join("|"),
    [bomItems]
  );

  useEffect(() => {
    setJigDraftByItemId(
      Object.fromEntries(
        bomItems.map((i) => [
          i.id,
          i.jigModel?.trim() ? i.jigModel : "",
        ])
      )
    );
  }, [bomSyncKey, bomItems]);

  const handleLiveDraft = useCallback((id: string, draft: string) => {
    setJigDraftByItemId((prev) =>
      prev[id] === draft ? prev : { ...prev, [id]: draft }
    );
  }, []);

  const handleJigCommit = useCallback(
    (bomItemId: string, next: string | null) => {
      const row = bomItems.find((i) => i.id === bomItemId);
      if (!row) return;
      if (sameJigModel(row.jigModel, next)) return;

      startTransition(async () => {
        try {
          await updateBomItemJig(bomItemId, next, product.id, false);
          toast.success("治具匹配已保存");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "保存失败");
        }
      });
    },
    [bomItems, product.id, router]
  );

  function handleApplyJigGlobally(item: BomItem) {
    const raw =
      jigDraftByItemId[item.id] ?? (item.jigModel?.trim() ? item.jigModel : "");
    const jigModel = normalizeJigModelInputForStorage(raw);
    startTransition(async () => {
      try {
        const { updated: n } = await updateBomItemJig(
          item.id,
          jigModel,
          product.id,
          true
        );
        toast.success(
          n > 0
            ? `全厂已更新 ${n} 条 BOM（连接器「${item.connectorModel}」→ 统一为 ${
                jigModel ?? "未指派"
              }）`
            : "未找到可更新的记录"
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "全厂同步失败");
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

  const unmatchedCount = bomItems.filter((b) =>
    bomRowNeedsJigAssignment(b.jigModel)
  ).length;

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
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回上一页
        </button>
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
          <div className="flex items-center gap-2">
            <BulkBomImportDialog
              fixedProduct={{
                id: product.id,
                code: product.code,
                customerName: product.customer.name,
              }}
            />
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
      </div>

      {bomItems.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          <div className="text-center">
            <Plug className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">
              暂无 BOM，可使用上方「表三 BOM 白名单导入」或客户页的「智能导入 BOM」
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="min-w-[100px]">物料编码</TableHead>
                <TableHead className="min-w-[80px]">位号</TableHead>
                <TableHead>连接器型号</TableHead>
                <TableHead className="max-w-[200px]">描述</TableHead>
                <TableHead className="w-24">数量</TableHead>
                <TableHead className="min-w-[280px]">匹配治具</TableHead>
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
                    <span className="font-mono text-xs text-slate-700">
                      {item.partNumber ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {item.designator ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Plug className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-sm font-medium text-slate-800">
                        {item.connectorModel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-slate-500" title={item.description ?? undefined}>
                    {item.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="tabular-nums">
                      {item.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1">
                      <Link2 className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <JigCreatableCombobox
                        itemId={item.id}
                        jigModel={item.jigModel}
                        jigOptions={jigModels}
                        disabled={isPending}
                        onLiveDraftChange={(d) => handleLiveDraft(item.id, d)}
                        onCommit={(next) => handleJigCommit(item.id, next)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-0.5 shrink-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        disabled={isPending}
                        title={`全厂穿透：将所有产品中连接器「${item.connectorModel}」的匹配治具统一为当前输入/选择`}
                        aria-label={`全厂应用治具到连接器 ${item.connectorModel}`}
                        onClick={() => handleApplyJigGlobally(item)}
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
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
        {bomItems.filter((b) => b.jigModel?.trim()).length} 项
        {unmatchedCount > 0 && (
          <span className="text-amber-500"> · {unmatchedCount} 项待匹配</span>
        )}
        <span className="block mt-1 text-slate-500">
          匹配治具支持输入新型号；失焦或回车保存。⚡
          将当前值同步到全库相同连接器型号的所有 BOM 行。
        </span>
      </p>
    </div>
  );
}
