"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface OrderStat {
  status: string;
  _count: number;
}

const statusMap: Record<string, { label: string; color: string }> = {
  READY: { label: "齐套可生产", color: "#10b981" }, // emerald-500
  SHORTAGE: { label: "缺料需采购", color: "#ef4444" }, // red-500
  NO_BOM: { label: "待工程配BOM", color: "#94a3b8" }, // slate-400
};

export function StatusChart({ data }: { data: OrderStat[] }) {
  const chartData = data.map((d) => {
    const config = statusMap[d.status] || {
      label: d.status,
      color: "#cbd5e1",
    };
    return {
      name: config.label,
      value: d._count,
      color: config.color,
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
        暂无订单数据
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            itemStyle={{ color: "#334155", fontSize: "14px", fontWeight: 500 }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", color: "#64748b" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
