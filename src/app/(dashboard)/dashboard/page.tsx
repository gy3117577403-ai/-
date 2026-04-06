import { Package, Boxes, AlertTriangle, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { StatusChart } from "@/components/dashboard/status-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const [
    productCount,
    jigAgg,
    shortageOrders,
    pendingPurchases,
    orderStats,
    recentLogs,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.jigBaseInventory.aggregate({
      _sum: { quantity: true },
      where: { category: "JIG" },
    }),
    prisma.order.count({ where: { status: "SHORTAGE" } }),
    prisma.purchaseRequest.count({ where: { status: "PENDING" } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.operationLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const jigTotal = jigAgg._sum.quantity || 0;

  const stats = [
    {
      label: "产品总数",
      value: productCount,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-slate-200",
    },
    {
      label: "生产治具总量",
      value: jigTotal,
      icon: Boxes,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-slate-200",
    },
    {
      label: "缺料预警订单",
      value: shortageOrders,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: shortageOrders > 0 ? "border-red-200" : "border-slate-200",
      valueColor: shortageOrders > 0 ? "text-red-600" : "text-slate-800",
    },
    {
      label: "待审批请购单",
      value: pendingPurchases,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: pendingPurchases > 0 ? "border-amber-200" : "border-slate-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">总览看板</h1>
        <p className="mt-1 text-sm text-slate-500">
          治具管理系统核心数据与实时动态
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg, border, valueColor }) => (
          <Card key={label} className={`shadow-sm ${border}`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className={`mt-2 text-3xl font-bold ${valueColor || "text-slate-800"}`}>
                  {value}
                </p>
              </div>
              <div className={`rounded-lg ${bg} p-3`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">工单齐套率与状态分布</CardTitle>
            <CardDescription>当前所有生产开工记录的状态统计</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart data={orderStats} />
          </CardContent>
        </Card>

        <Card className="shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">最近业务动态</CardTitle>
            <CardDescription>实时捕捉核心系统操作日志</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {recentLogs.length > 0 ? (
              <div className="space-y-5">
                {recentLogs.map((log) => (
                  <div key={log.id} className="relative pl-4 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-amber-400">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-medium text-slate-800">
                        {log.operator}
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-amber-600">{log.action}</span>
                      </p>
                      <time className="text-xs text-slate-400 font-mono">
                        {format(new Date(log.createdAt), "MM-dd HH:mm")}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      [{log.module}] {log.details}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
                暂无最新动态
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
