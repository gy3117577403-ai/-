"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { markOrderedWithDetailsAction } from "@/lib/actions/purchase";
import { toast } from "sonner";

const THRESHOLD = 500;

const schema = z
  .object({
    actualCost: z.coerce
      .number()
      .refine((n) => Number.isFinite(n) && n > 0, "实际金额须大于 0"),
    contractNo: z.string().optional(),
    invoiceNo: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.actualCost >= THRESHOLD) {
      const c = data.contractNo?.trim() ?? "";
      if (!c) {
        ctx.addIssue({
          code: "custom",
          message: "合同编号为必填项",
          path: ["contractNo"],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseRequest | null;
  onSuccess?: () => void;
};

export function MarkOrderedDialog({
  open,
  onOpenChange,
  purchase,
  onSuccess,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      actualCost: 0,
      contractNo: "",
      invoiceNo: "",
    },
  });

  const actualCost = watch("actualCost");
  const showLargeFields =
    Number(actualCost) >= THRESHOLD && Number.isFinite(Number(actualCost));

  useEffect(() => {
    if (!open || !purchase) return;
    reset({
      actualCost: purchase.estimatedCost,
      contractNo: "",
      invoiceNo: "",
    });
  }, [open, purchase, reset]);

  async function onSubmit(values: FormValues) {
    if (!purchase) return;
    try {
      await markOrderedWithDetailsAction(
        purchase.id,
        values.actualCost,
        showLargeFields ? values.contractNo : undefined,
        showLargeFields ? values.invoiceNo : undefined
      );
      toast.success(`请购单 ${purchase.requestNo} 已标记已采购`);
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>标记已采购</DialogTitle>
          <DialogDescription>
            {purchase
              ? `登记实际花费（单号 ${purchase.requestNo}）。实际金额 ≥ ${THRESHOLD} 元须填写合同编号；付款请后续手动提交请款。`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form
          id="mark-ordered-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="actualCost">实际花费金额（元）*</Label>
            <Input
              id="actualCost"
              type="number"
              step="0.01"
              min={0.01}
              {...register("actualCost")}
              aria-invalid={!!errors.actualCost}
            />
            {errors.actualCost && (
              <p className="text-xs text-destructive">{errors.actualCost.message}</p>
            )}
          </div>

          {showLargeFields && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <p className="text-xs font-medium text-amber-900">
                大额采购（≥ {THRESHOLD} 元）：须登记合同编号；付款请后续手动提交请款。
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="contractNo">合同编号 *</Label>
                <Input
                  id="contractNo"
                  placeholder="对公合同编号"
                  {...register("contractNo")}
                  aria-invalid={!!errors.contractNo}
                />
                {errors.contractNo && (
                  <p className="text-xs text-destructive">
                    {errors.contractNo.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoiceNo">发票编号（选填）</Label>
                <Input
                  id="invoiceNo"
                  placeholder="可后补"
                  {...register("invoiceNo")}
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "提交中…" : "确认已采购"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
