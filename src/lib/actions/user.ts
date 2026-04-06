"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AUTH_SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import type { Role } from "@prisma/client";

export async function login(username: string, password: string) {
  const u = username.trim();
  if (!u || !password) return { error: "请填写账号和密码" };

  const user = await prisma.user.findUnique({ where: { username: u } });
  if (!user || user.password !== password) {
    return { error: "账号或密码错误" };
  }

  // 必须在声明了 "use server" 的本文件内直接调用 cookies().set，
  // 否则 Next 15+ 可能判定不在 Server Action 上下文而抛错。
  const store = await cookies();
  const payload = JSON.stringify({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: String(user.role),
  });
  store.set(AUTH_SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return { ok: true as const };
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(AUTH_SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function getUsers() {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    throw new Error("无权限");
  }
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function createUser(data: {
  username: string;
  password: string;
  name: string;
  role: Role;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    throw new Error("无权限");
  }
  const username = data.username.trim();
  const name = data.name.trim();
  if (!username || !data.password || !name) {
    throw new Error("请填写完整信息");
  }

  await prisma.user.create({
    data: {
      username,
      password: data.password,
      name,
      role: data.role,
    },
  });

  revalidatePath("/users");
}

export async function updateUser(
  id: string,
  data: { name: string; role: Role; password?: string }
) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    throw new Error("无权限");
  }
  const name = data.name.trim();
  if (!name) {
    throw new Error("姓名不能为空");
  }

  const updateData: { name: string; role: Role; password?: string } = {
    name,
    role: data.role,
  };

  if (data.password && data.password.trim() !== "") {
    updateData.password = data.password;
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/users");
}

export async function deleteUser(id: string) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    throw new Error("无权限");
  }
  if (session.userId === id) {
    throw new Error("不能删除当前登录账号");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
}
