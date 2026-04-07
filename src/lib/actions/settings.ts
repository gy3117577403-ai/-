"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** 数据库不可用或表未就绪时的安全降级，避免 Layout 整页 500 */
const DEFAULT_SETTINGS = {
  systemName: "治具管理系统",
  announcement: "",
  enableConfetti: "false",
} as const;

export type AppSettings = {
  systemName: string;
  announcement: string;
  enableConfetti: string;
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const records = await prisma.systemSetting.findMany();
    const map = new Map(records.map((r) => [r.key, r.value]));

    return {
      systemName: map.get("systemName") || DEFAULT_SETTINGS.systemName,
      announcement: map.get("announcement") || DEFAULT_SETTINGS.announcement,
      enableConfetti: map.get("enableConfetti") || DEFAULT_SETTINGS.enableConfetti,
    };
  } catch (error) {
    console.error(
      "[getSettings] 读取 SystemSetting 失败，已降级为默认配置。请检查 DATABASE_URL 与 prisma db push 是否已执行:",
      error instanceof Error ? error.message : error
    );
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(data: {
  systemName?: string;
  announcement?: string;
  enableConfetti?: string;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    throw new Error("无权限");
  }

  const updates = [];
  if (data.systemName !== undefined) {
    updates.push({ key: "systemName", value: data.systemName.trim() });
  }
  if (data.announcement !== undefined) {
    updates.push({ key: "announcement", value: data.announcement.trim() });
  }
  if (data.enableConfetti !== undefined) {
    updates.push({ key: "enableConfetti", value: data.enableConfetti });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.systemSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  revalidatePath("/", "layout");
}
