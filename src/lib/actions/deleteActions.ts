"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const UNAUTH = "无权操作：仅系统管理员可执行删除";

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error(UNAUTH);
  }
}

export async function deleteCustomer(customerId: string) {
  await assertAdmin();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) throw new Error("客户不存在");

  const orderCount = await prisma.order.count({
    where: { product: { customerId } },
  });
  if (orderCount > 0) {
    throw new Error("该客户下存在生产开工记录，禁止删除客户！");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomItem.deleteMany({
      where: { product: { customerId } },
    });
    await tx.product.deleteMany({ where: { customerId } });
    await tx.customer.delete({ where: { id: customerId } });
  });

  revalidatePath("/customers");
}

export async function deleteProduct(productId: string) {
  await assertAdmin();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new Error("产品不存在");

  const orderCount = await prisma.order.count({ where: { productId } });
  if (orderCount > 0) {
    throw new Error("该产品已有生产记录，禁止删除！");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomItem.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
  });

  revalidatePath("/customers");
  revalidatePath(`/products/${productId}/bom`);
}

export async function deleteConnector(bomItemId: string) {
  await assertAdmin();

  const item = await prisma.bomItem.findUnique({
    where: { id: bomItemId },
    select: { id: true, productId: true },
  });
  if (!item) throw new Error("连接器明细不存在");

  await prisma.bomItem.delete({ where: { id: bomItemId } });

  revalidatePath("/customers");
  revalidatePath(`/products/${item.productId}/bom`);
}
