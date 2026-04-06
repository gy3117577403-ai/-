"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getMolds() {
  return prisma.threeDMold.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createMold(data: {
  name: string;
  productModel: string;
  printParams?: string;
  scadCode: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "ENGINEER") {
    throw new Error("仅管理员或工程师可创建模具");
  }

  const { name, productModel, printParams, scadCode } = data;
  if (!name.trim() || !productModel.trim() || !scadCode.trim()) {
    throw new Error("请填写必填字段");
  }

  await prisma.threeDMold.create({
    data: {
      name: name.trim(),
      productModel: productModel.trim(),
      printParams: printParams?.trim() || null,
      scadCode: scadCode.trim(),
    },
  });

  revalidatePath("/molds");
}

export async function updateMold(
  id: string,
  data: {
    name: string;
    productModel: string;
    printParams?: string;
    scadCode: string;
  }
) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "ENGINEER") {
    throw new Error("仅管理员或工程师可更新模具");
  }

  const { name, productModel, printParams, scadCode } = data;
  if (!name.trim() || !productModel.trim() || !scadCode.trim()) {
    throw new Error("请填写必填字段");
  }

  await prisma.threeDMold.update({
    where: { id },
    data: {
      name: name.trim(),
      productModel: productModel.trim(),
      printParams: printParams?.trim() || null,
      scadCode: scadCode.trim(),
    },
  });

  revalidatePath("/molds");
}

export async function deleteMold(id: string) {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  if (session.role !== "ADMIN" && session.role !== "ENGINEER") {
    throw new Error("仅管理员或工程师可删除模具");
  }

  await prisma.threeDMold.delete({ where: { id } });
  revalidatePath("/molds");
}
