"use server";

import { prisma } from "@/lib/prisma";

export async function getLogs() {
  return prisma.operationLog.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createLog(
  operator: string,
  action: string,
  module: string,
  details: string
) {
  try {
    await prisma.operationLog.create({
      data: {
        operator,
        action,
        module,
        details,
      },
    });
  } catch (error) {
    // 静默处理日志写入失败，不影响主业务
    console.error("写入操作日志失败:", error);
  }
}
