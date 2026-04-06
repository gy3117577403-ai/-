import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { getSettings } from "@/lib/actions/settings";
import { Megaphone } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col lg:pl-60 min-h-screen">
        <Header />
        {settings.announcement && (
          <div className="bg-amber-100 border-b border-amber-200 px-6 py-2.5 flex items-center text-amber-800 text-sm font-medium">
            <Megaphone className="h-4 w-4 mr-2 shrink-0 text-amber-600" />
            <span>{settings.announcement}</span>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
