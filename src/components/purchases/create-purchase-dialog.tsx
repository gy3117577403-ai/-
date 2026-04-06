"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { createPurchase } from "@/lib/actions/purchase";
import { toast } from "sonner";
import type { ItemCategory } from "@prisma/client";

const schema = z.object({
  applicant: z.string().min(1, "请填写申请人"),
  itemName: z.string().min(1, "请填写物资型号"),
  quantity: z.coerce.number().int("必须为整数").min(1, "数量必须大于 0"),
  estimatedCost: z.coerce.number().min(0, "金额不能为负"),
  link: z.string().optional(),
});

type FormValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseDialog({ open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<ItemCategory>("JIG");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      applicant: "",
      itemName: "",
      quantity: 1,
      estimatedCost: 0,
      link: "",
    },
  });

  useEffect(() => {
    if (open) {
      setCategory("JIG");
      reset({
        applicant: "",
        itemName: "",
        quantity: 1,
        estimatedCost: 0,
        link: "",
      });
    }
  }, [open, reset]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await createPurchase({ ...values, category });
        toast.success("请购单已提交，等待审批");
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "提交失败");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建请购申请</DialogTitle>
          <DialogDescription>填写物资信息后提交审批</DialogDescription>
        </DialogHeader>

        <form
          id="purchase-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="itemName">物资型号</Label>
            <Input
              id="itemName"
              placeholder="例: DF62S-10EP-2.2C"
              {...register("itemName")}
              aria-invalid={!!errors.itemName}
            />
            {errors.itemName && (
              <p className="text-xs text-destructive">
                {errors.itemName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">数量</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                placeholder="1"
                {...register("quantity")}
                aria-invalid={!!errors.quantity}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">
                  {errors.quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedCost">预估金额 (元)</Label>
              <Input
                id="estimatedCost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                {...register("estimatedCost")}
                aria-invalid={!!errors.estimatedCost}
              />
              {errors.estimatedCost && (
                <p className="text-xs text-destructive">
                  {errors.estimatedCost.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link">购买链接 (选填)</Label>
            <Input
              id="link"
              placeholder="https://..."
              {...register("link")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" form="purchase-form" disabled={isPending}>
            {isPending ? "提交中…" : "提交申请"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
