import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getLogs } from "@/lib/actions/log";
import { DataTable } from "./data-table";
import { columns } from "./columns";

export default async function LogsPage() {
  const session = await getSession();
  if (session?.role !== "ADMIN" && session?.role !== "BOSS") {
    redirect("/");
  }

  const logs = await getLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">操作日志追踪</h1>
        <p className="mt-1 text-sm text-slate-500">
          核心业务操作审计与防篡改追溯看板
        </p>
      </div>

      <DataTable columns={columns} data={logs} />
    </div>
  );
}
