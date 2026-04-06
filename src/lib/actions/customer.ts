"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getCustomersWithProducts() {
  return prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { bomItems: true } } },
      },
    },
  });
}

export async function createCustomer(data: { code: string; name: string }) {
  await prisma.customer.create({ data });
  revalidatePath("/customers");
}
