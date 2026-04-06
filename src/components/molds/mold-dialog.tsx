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
import { createMold, updateMold } from "@/lib/actions/mold";
import { toast } from "sonner";
import { Code } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "请输入模具名称"),
  productModel: z.string().min(1, "请输入适用产品型号"),
  printParams: z.string().optional(),
  scadCode: z.string().min(1, "请输入 OpenSCAD 源码"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    name: string;
    productModel: string;
    printParams: string | null;
    scadCode: string;
  } | null;
}

export function MoldDialog({ open, onOpenChange, editData }: Props) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", productModel: "", printParams: "", scadCode: "" },
  });

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({
          name: editData.name,
          productModel: editData.productModel,
          printParams: editData.printParams || "",
          scadCode: editData.scadCode,
        });
      } else {
        reset({ name: "", productModel: "", printParams: "", scadCode: "" });
      }
    }
  }, [open, editData, reset]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateMold(editData.id, values);
          toast.success("修改成功");
        } else {
          await createMold(values);
          toast.success("新建成功");
        }
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <DialogHeader>
            <DialogTitle>{isEdit ? "编辑 3D 打印模具" : "新建 3D 打印模具"}</DialogTitle>
            <DialogDescription>
              维护 OpenSCAD 建模源码与打印参数配置
            </DialogDescription>
          </DialogHeader>
        </div>

        <form id="mold-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-auto">
          <div className="flex flex-col lg:flex-row h-full">
            {/* 左侧：基本信息 */}
            <div className="w-full lg:w-1/3 p-6 space-y-5 border-r border-slate-200 bg-slate-50">
              <div className="space-y-1.5">
                <Label htmlFor="name">模具名称 <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  placeholder="例: 打胶限位器"
                  {...register("name")}
                  className="bg-white"
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="productModel">适用产品型号 <span className="text-red-500">*</span></Label>
                <Input
                  id="productModel"
                  placeholder="例: DF62-10ES"
                  {...register("productModel")}
                  className="bg-white"
                />
                {errors.productModel && (
                  <p className="text-xs text-red-500">{errors.productModel.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="printParams">打印参数 (选填)</Label>
                <Input
                  id="printParams"
                  placeholder="例: PLA, 20%填充, 层高0.2mm"
                  {...register("printParams")}
                  className="bg-white"
                />
              </div>
            </div>

            {/* 右侧：代码编辑器区 */}
            <div className="w-full lg:w-2/3 flex flex-col bg-[#1e1e1e]">
              <div className="flex items-center px-4 py-2 border-b border-[#333]">
                <Code className="h-4 w-4 text-[#858585] mr-2" />
                <span className="text-xs text-[#858585] font-mono">OpenSCAD Source Code</span>
              </div>
              <textarea
                {...register("scadCode")}
                spellCheck={false}
                className="flex-1 w-full bg-transparent text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none"
                placeholder="// 粘贴您的 OpenSCAD 源码..."
                style={{ lineHeight: "1.6" }}
              />
              {errors.scadCode && (
                <div className="px-4 py-2 bg-red-950 border-t border-red-900 text-xs text-red-400">
                  {errors.scadCode.message}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 bg-white">
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" form="mold-form" disabled={isPending}>
              {isPending ? "保存中..." : "保存记录"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
