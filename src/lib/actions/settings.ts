"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getSettings() {
  const records = await prisma.systemSetting.findMany();
  const map = new Map(records.map((r) => [r.key, r.value]));

  return {
    systemName: map.get("systemName") || "治具管理系统",
    announcement: map.get("announcement") || "",
    enableConfetti: map.get("enableConfetti") || "false",
  };
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
