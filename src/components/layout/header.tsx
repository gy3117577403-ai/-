import { Menu } from "lucide-react";
import { SyncButton } from "@/components/SyncButton";
import { NotificationBell } from "@/components/layout/notification-bell";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <button
        type="button"
        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell />
        <SyncButton />
      </div>
    </header>
  );
}
