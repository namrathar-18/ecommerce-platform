import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie,
} from "recharts";
import { api } from "../../lib/api";

const PALETTE = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ef4444"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4 text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const [top, setTop] = useState<any[]>([]);
  const [rev, setRev] = useState<any[]>([]);
  const [leader, setLeader] = useState<any[]>([]);
  const [clv, setClv] = useState<any[]>([]);

  useEffect(() => {
    api.get("/admin/analytics/top-products").then((r) => setTop(r.data)).catch(() => {});
    api.get("/admin/analytics/revenue-by-category").then((r) => setRev(r.data)).catch(() => {});
    api.get("/admin/analytics/vendor-leaderboard").then((r) => setLeader(r.data)).catch(() => {});
    api.get("/admin/analytics/clv").then((r) => setClv(r.data)).catch(() => {});
  }, []);

  // Pivot revenue rows (category, month, revenue) into per-month series for the line chart.
  const revByMonth = useMemo(() => {
    const months = [...new Set(rev.map((r) => r.month))].sort();
    const cats = [...new Set(rev.map((r) => r.category_name))];
    return {
      cats,
      data: months.map((m) => {
        const row: any = { month: String(m).slice(0, 7) };
        for (const c of cats) {
          const hit = rev.find((r) => r.month === m && r.category_name === c);
          row[c] = hit ? Number(hit.revenue) : 0;
        }
        return row;
      }),
    };
  }, [rev]);

  const clvSegments = useMemo(() => {
    const bySeg: Record<string, number> = {};
    for (const c of clv) bySeg[c.segment] = (bySeg[c.segment] ?? 0) + 1;
    return Object.entries(bySeg).map(([name, value]) => ({ name, value }));
  }, [clv]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 text-white p-6">
        <h1 className="text-2xl font-bold">Admin Analytics</h1>
        <p className="text-white/70 text-sm mt-1">
          Live SQL analytics — window functions, joins &amp; aggregations straight from MySQL.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="🏆 Top Products (this month)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="units_sold" name="Units sold" radius={[6, 6, 0, 0]}>
                {top.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="📈 Revenue by Category (month over month)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revByMonth.data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {revByMonth.cats.map((c, i) => (
                <Line key={c} type="monotone" dataKey={c} stroke={PALETTE[i % PALETTE.length]} strokeWidth={3} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-2">
            {rev.filter((r) => r.mom_growth_pct != null).map((r, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded-full ${Number(r.mom_growth_pct) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {r.category_name} {String(r.month).slice(0, 7)}: {Number(r.mom_growth_pct) >= 0 ? "▲" : "▼"} {r.mom_growth_pct}%
              </span>
            ))}
          </div>
        </Card>

        <Card title="🥇 Vendor Leaderboard">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={leader} layout="vertical" margin={{ left: 30, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="store_name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="total_revenue" name="Revenue (₹)" radius={[0, 6, 6, 0]}>
                {leader.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-500 mt-1">
            {leader.map((v) => (
              <span key={v.vendor_id} className="mr-4">
                #{v.revenue_rank} {v.store_name} {v.avg_rating ? `· ★${v.avg_rating}` : ""}
              </span>
            ))}
          </div>
        </Card>

        <Card title="💎 Customer Lifetime Value">
          <div className="grid grid-cols-2 gap-2 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={clvSegments} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={4}>
                  {clvSegments.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {clv.slice(0, 8).map((c) => (
                <div key={c.user_id} className="flex justify-between border-b last:border-0 py-1">
                  <span>{c.name}</span>
                  <span className="font-medium">₹{Number(c.lifetime_value).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
