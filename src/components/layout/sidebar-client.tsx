"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  ClipboardList,
  ShoppingCart,
  Settings,
  Wrench,
  Users,
  History,
  Cuboid,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";

const baseNavItems = [
  { href: "/dashboard", label: "总览看板", icon: LayoutDashboard },
  { href: "/customers", label: "客户与产品", icon: Building2 },
  { href: "/jig-inventory", label: "全厂物资总仓", icon: Package },
  { href: "/molds", label: "3D打印模具库", icon: Cuboid },
  { href: "/orders", label: "生产开工记录", icon: ClipboardList },
  { href: "/purchases", label: "物品采购审批", icon: ShoppingCart },
  { href: "/settings", label: "系统设置", icon: Settings },
];

const roleLabelMap: Record<string, string> = {
  ADMIN: "管理员",
  BOSS: "领导",
  PURCHASER: "采购",
  ENGINEER: "工程师",
};

function noopSubscribe() {
  return () => {};
}

export default function SidebarClient({
  session,
  systemName,
}: {
  session: SessionUser | null;
  systemName: string;
}) {
  const pathname = usePathname();
  const isMounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const navItems = [...baseNavItems];

  if (session?.role === "ADMIN") {
    navItems.splice(6, 0, { href: "/users", label: "账号权限管理", icon: Users });
  }

  if (session?.role === "ADMIN" || session?.role === "BOSS") {
    navItems.push({ href: "/logs", label: "操作日志追踪", icon: History });
  }

  const displayName = session?.name ?? "未登录";
  const roleKey = session?.role ?? "";
  const roleZh = (roleLabelMap[roleKey] ?? roleKey) || "访客";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500">
          <Wrench className="h-4 w-4 text-slate-900" />
        </div>
        <div className="leading-none">
          <span className="text-sm font-bold tracking-wider text-white">
            {systemName}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href + label}
              href={href}
              className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  active
                    ? "text-amber-400"
                    : "text-slate-500 group-hover:text-slate-400"
                }`}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-4 py-3 space-y-3">
        <div className="text-xs text-slate-400 leading-snug">
          <span className="mr-1" aria-hidden>
            👨‍💻
          </span>
          {isMounted ? (
            <>
              {displayName}{" "}
              <span className="text-slate-500">({roleZh})</span>
            </>
          ) : (
            "加载中..."
          )}
        </div>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            退出登录
          </Button>
        </form>
        <p className="text-[10px] text-slate-600">v0.1.0 · Powered by Next.js</p>
      </div>
    </aside>
  );
}
