"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getBomItems(productId: string) {
  return prisma.bomItem.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProductWithCustomer(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { customer: true },
  });
}

export async function getAvailableJigModels() {
  const rows = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
    select: { modelCode: true },
    orderBy: { modelCode: "asc" },
  });
  return rows.map((r) => r.modelCode);
}

export async function updateBomItemJig(
  bomItemId: string,
  jigModel: string | null
) {
  const item = await prisma.bomItem.update({
    where: { id: bomItemId },
    data: { jigModel },
  });
  revalidatePath(`/products/${item.productId}/bom`);
}

export async function autoMatchBomJigs(productId: string) {
  const unmatched = await prisma.bomItem.findMany({
    where: { productId, jigModel: null },
  });

  if (unmatched.length === 0) {
    return { matched: 0, total: 0 };
  }

  const inventories = await prisma.jigBaseInventory.findMany({
    where: { category: "JIG" },
    select: { modelCode: true, matingModel: true },
  });

  let matched = 0;

  for (const item of unmatched) {
    const needle = item.connectorModel.toLowerCase();
    const hit = inventories.find(
      (inv) => inv.matingModel && inv.matingModel.toLowerCase().includes(needle)
    );

    if (hit) {
      await prisma.bomItem.update({
        where: { id: item.id },
        data: { jigModel: hit.modelCode },
      });
      matched++;
    }
  }

  revalidatePath(`/products/${productId}/bom`);
  return { matched, total: unmatched.length };
}
