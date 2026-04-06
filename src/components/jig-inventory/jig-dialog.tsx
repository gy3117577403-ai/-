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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { upsertJigInventory } from "@/lib/actions/jig-inventory";
import { toast } from "sonner";

const schema = z.object({
  modelCode: z.string().min(1, "请输入治具型号"),
  quantity: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
    z.number().int("数量必须是整数").min(0, "数量不能小于0")
  ),
  matingModel: z.string().optional(),
  remarks: z.string().optional(),
});

type FormValues = z.output<typeof schema>;

interface JigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    modelCode: string;
    matingModel: string | null;
    quantity: number;
    remarks: string | null;
  } | null;
}

export function JigDialog({ open, onOpenChange, editData }: JigDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { modelCode: "", matingModel: "", quantity: 0, remarks: "" },
  });

  useEffect(() => {
    if (open) {
      setServerError("");
      if (editData) {
        reset({
          modelCode: editData.modelCode,
          matingModel: editData.matingModel ?? "",
          quantity: editData.quantity,
          remarks: editData.remarks ?? "",
        });
      } else {
        reset({ modelCode: "", matingModel: "", quantity: 0, remarks: "" });
      }
    }
  }, [open, editData, reset]);

  function onSubmit(values: FormValues) {
    setServerError("");
    startTransition(async () => {
      try {
        await upsertJigInventory({
          id: editData?.id,
          modelCode: values.modelCode,
          matingModel: values.matingModel || undefined,
          quantity: values.quantity,
          remarks: values.remarks || undefined,
        });
        toast.success(isEdit ? "修改成功" : "录入成功");
        onOpenChange(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "操作失败";
        setServerError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑治具库存" : "手动录入治具"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改治具总仓记录" : "向总仓新增一条治具库存记录"}
          </DialogDescription>
        </DialogHeader>

        <form
          id="jig-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="modelCode">治具型号</Label>
            <Input
              id="modelCode"
              placeholder="例: DF62S-10EP-2.2C"
              {...register("modelCode")}
              aria-invalid={!!errors.modelCode}
              disabled={isEdit}
            />
            {errors.modelCode && (
              <p className="text-xs text-destructive">
                {errors.modelCode.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="matingModel">对插型号</Label>
            <Input
              id="matingModel"
              placeholder="例: DF62-10ES-2.2C (选填)"
              {...register("matingModel")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">数量</Label>
            <Input
              id="quantity"
              type="number"
              min={0}
              placeholder="0"
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
            <Label htmlFor="remarks">备注</Label>
            <Input
              id="remarks"
              placeholder="选填"
              {...register("remarks")}
            />
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" form="jig-form" disabled={isPending}>
            {isPending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
