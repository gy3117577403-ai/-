"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getJigBaseInventories() {
  return prisma.jigBaseInventory.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertJigInventory(data: {
  id?: string;
  modelCode: string;
  matingModel?: string;
  quantity: number;
  remarks?: string;
}) {
  if (!data.modelCode.trim()) throw new Error("治具型号不能为空");

  const code = data.modelCode.trim();
  const mating = data.matingModel?.trim() || "";
  const remark = data.remarks?.trim() || "";

  try {
    await prisma.jigBaseInventory.upsert({
      where: { modelCode: code },
      update: {
        quantity: data.quantity,
        matingModel: mating,
        remarks: remark,
      },
      create: {
        modelCode: code,
        quantity: data.quantity,
        matingModel: mating,
        remarks: remark,
      },
    });
  } catch {
    throw new Error("保存失败，请检查数据格式。");
  }

  revalidatePath("/jig-inventory");
}

interface ImportItem {
  modelCode: string;
  matingModel?: string;
  quantity: number;
  remarks?: string;
}

export async function batchImportJigs(items: ImportItem[]) {
  if (!items.length) throw new Error("导入数据为空");

  await prisma.$transaction(
    items.map((item) =>
      prisma.jigBaseInventory.upsert({
        where: { modelCode: item.modelCode },
        update: {
          quantity: { increment: item.quantity },
          ...(item.matingModel ? { matingModel: item.matingModel } : {}),
          ...(item.remarks ? { remarks: item.remarks } : {}),
        },
        create: {
          modelCode: item.modelCode,
          matingModel: item.matingModel || null,
          quantity: item.quantity,
          remarks: item.remarks || null,
        },
      })
    )
  );

  revalidatePath("/jig-inventory");
}

export async function deleteJigInventory(id: string) {
  await prisma.jigBaseInventory.delete({ where: { id } });
  revalidatePath("/jig-inventory");
}
