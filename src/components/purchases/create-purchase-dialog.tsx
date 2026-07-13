"use client";

import { useEffect, useState, useTransition } from "react";
import {
  useFieldArray,
  useForm,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPurchaseAction } from "@/lib/actions/purchase";
import { toast } from "sonner";
import type { ItemCategory, PurchaseUrgency } from "@prisma/client";

const urgencyOptions: Array<{
  value: PurchaseUrgency;
  label: string;
  dotClassName: string;
}> = [
  { value: "NORMAL", label: "普通", dotClassName: "bg-slate-400" },
  { value: "URGENT", label: "紧急", dotClassName: "bg-amber-500" },
  { value: "CRITICAL", label: "特急", dotClassName: "bg-red-600" },
];

const itemSchema = z.object({
  itemName: z.string().min(1, "请填写物资型号"),
  quantity: z.coerce.number().int("必须为整数").min(1, "数量必须大于 0"),
  estimatedCost: z.coerce.number().min(0, "金额不能为负"),
  link: z.string().optional(),
});

const schema = z.object({
  applicant: z.string().min(1, "请填写申请人"),
  items: z.array(itemSchema).min(1, "请至少添加一项物资"),
});

type FormValues = z.output<typeof schema>;

const emptyItem = {
  itemName: "",
  quantity: 1,
  estimatedCost: 0,
  link: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseDialog({ open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<ItemCategory>("JIG");
  const [urgency, setUrgency] = useState<PurchaseUrgency>("NORMAL");

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      applicant: "",
      items: [emptyItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setCategory("JIG");
      setUrgency("NORMAL");
      reset({
        applicant: "",
        items: [emptyItem],
      });
    });
  }, [open, reset]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        const result = await createPurchaseAction({
          applicant: values.applicant,
          category,
          urgency,
          items: values.items,
        });
        toast.success(`已提交 ${result.count} 项请购，等待审批`);
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "提交失败");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>新建请购申请</DialogTitle>
          <DialogDescription>
            批量添加多个物资后一次提交，系统只发送一条合并审批通知。
          </DialogDescription>
        </DialogHeader>

        <form
          id="purchase-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="applicant">申请人</Label>
              <Input
                id="applicant"
                placeholder="请输入姓名"
                {...register("applicant")}
                aria-invalid={!!errors.applicant}
              />
              {errors.applicant && (
                <p className="text-xs text-destructive">
                  {errors.applicant.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>物资类型</Label>
              <Select
                value={category}
                onValueChange={(v) =>
                  setCategory((v ?? "JIG") as ItemCategory)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JIG">生产治具</SelectItem>
                  <SelectItem value="OTHER">其他工具/设备</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>紧急程度</Label>
              <Select
                value={urgency}
                onValueChange={(value) =>
                  setUrgency((value ?? "NORMAL") as PurchaseUrgency)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${option.dotClassName}`}
                        aria-hidden="true"
                      />
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>物资明细</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyItem)}
              disabled={isPending}
            >
              ➕ 添加项
            </Button>
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {fields.map((field, index) => {
              const itemErrors = errors.items?.[index];

              return (
                <div
                  key={field.id}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      物资 {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      disabled={isPending || fields.length === 1}
                      aria-label="删除物资项"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_96px_128px]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`item-${index}-name`}>物资型号</Label>
                      <Input
                        id={`item-${index}-name`}
                        placeholder="例：DF62S-10EP-2.2C"
                        {...register(`items.${index}.itemName`)}
                        aria-invalid={!!itemErrors?.itemName}
                      />
                      {itemErrors?.itemName && (
                        <p className="text-xs text-destructive">
                          {itemErrors.itemName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`item-${index}-quantity`}>数量</Label>
                      <Input
                        id={`item-${index}-quantity`}
                        type="number"
                        min={1}
                        placeholder="1"
                        {...register(`items.${index}.quantity`)}
                        aria-invalid={!!itemErrors?.quantity}
                      />
                      {itemErrors?.quantity && (
                        <p className="text-xs text-destructive">
                          {itemErrors.quantity.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`item-${index}-cost`}>
                        预估金额 (元)
                      </Label>
                      <Input
                        id={`item-${index}-cost`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.estimatedCost`)}
                        aria-invalid={!!itemErrors?.estimatedCost}
                      />
                      {itemErrors?.estimatedCost && (
                        <p className="text-xs text-destructive">
                          {itemErrors.estimatedCost.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor={`item-${index}-link`}>
                      购买链接 (选填)
                    </Label>
                    <Input
                      id={`item-${index}-link`}
                      placeholder="https://..."
                      {...register(`items.${index}.link`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" form="purchase-form" disabled={isPending}>
            {isPending ? "提交中..." : "提交请购"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
