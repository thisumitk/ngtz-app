"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { clsx } from "clsx";
import { Flame, Trophy, TrendingUp, Calendar } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { useAnalytics } from "@/hooks/use-analytics";

const RANGES = [
  { key: "week", label: "7D" },
  { key: "month", label: "30D" },
  { key: "quarter", label: "90D" },
  { key: "year", label: "1Y" },
];

function StatCard({
  icon: Icon, label, value, suffix, color,
}: {
  icon: React.ElementType; label: string; value: number | string; suffix?: string; color: string;
}) {
  return (
    <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-ngtz-muted font-mono tracking-wider uppercase">{label}</span>
      </div>
      <div className={clsx("text-2xl font-bold font-display", color)}>
        {value}{suffix && <span className="text-sm ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { status } = useSession();
  const [range, setRange] = useState("month");
  const { data, loading } = useAnalytics(range);

  if (status === "unauthenticated") redirect("/login");

  const habitStats = useMemo(() => {
    if (!data) return [];
    return data.habits.map((h) => {
      const aggs = data.aggregates.filter((a) => a.habitId === h.id);
      const green = aggs.find((a) => a.status === "green")?.count || 0;
      const yellow = aggs.find((a) => a.status === "yellow")?.count || 0;
      const red = aggs.find((a) => a.status === "red")?.count || 0;
      return {
        ...h, green, yellow, red,
        nonZero: green + yellow,
        total: green + yellow + red,
        streak: data.streaks[h.id] || 0,
        longestStreak: data.longestStreaks[h.id] || 0,
      };
    });
  }, [data]);

  const summary = useMemo(() => {
    if (!habitStats.length) return { totalNonZero: 0, bestStreak: 0, longestEver: 0, consistency: 0 };
    const totalNonZero = habitStats.reduce((s, h) => s + h.nonZero, 0);
    const bestStreak = Math.max(...habitStats.map((h) => h.streak));
    const longestEver = Math.max(...habitStats.map((h) => h.longestStreak));
    const totalLogged = habitStats.reduce((s, h) => s + h.total, 0);
    const consistency = totalLogged > 0 ? Math.round((totalNonZero / totalLogged) * 100) : 0;
    return { totalNonZero, bestStreak, longestEver, consistency };
  }, [habitStats]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dailyTotals.map((d) => ({
      date: d.date.slice(5),
      "Full (v1.0)": d.green,
      "Min (v0.1)": d.yellow,
      "Zero": d.red,
    }));
  }, [data]);

  const weeklyData = useMemo(() => {
    if (!data) return [];
    return data.weeklySummary.map((w) => ({
      week: `W${w.week.split("-")[1]}`,
      nonZero: w.nonZero,
      total: w.total,
      rate: w.total > 0 ? Math.round((w.nonZero / w.total) * 100) : 0,
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-ngtz-bg">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-200 font-display">Analytics</h1>
          <div className="flex gap-1 bg-ngtz-card border border-ngtz-border rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={clsx(
                  "px-3 py-1 rounded-md text-xs font-mono transition-all",
                  range === r.key ? "bg-[#1a1a1a] text-gray-200" : "text-[#555] hover:text-[#888]"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="text-center text-ngtz-muted text-sm font-mono py-12">Loading analytics...</div>
        )}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard icon={TrendingUp} label="Non-Zero Days" value={summary.totalNonZero} color="text-ngtz-yellow" />
              <StatCard icon={Flame} label="Current Streak" value={summary.bestStreak} suffix="d" color="text-ngtz-green" />
              <StatCard icon={Trophy} label="Longest Streak" value={summary.longestEver} suffix="d" color="text-ngtz-green" />
              <StatCard
                icon={Calendar} label="Consistency" value={`${summary.consistency}%`}
                color={summary.consistency >= 80 ? "text-ngtz-green" : summary.consistency >= 50 ? "text-ngtz-yellow" : "text-ngtz-red"}
              />
            </div>

            {/* Daily stacked bar chart */}
            <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-4 mb-6">
              <h3 className="text-xs text-ngtz-muted font-mono tracking-wider mb-4">DAILY LOG BREAKDOWN</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barGap={0} barCategoryGap="20%">
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#555", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      interval={Math.max(0, Math.floor(chartData.length / 8))}
                      axisLine={{ stroke: "#222" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111", border: "1px solid #222",
                        borderRadius: "8px", fontSize: "11px", fontFamily: "JetBrains Mono",
                      }}
                      labelStyle={{ color: "#888" }}
                    />
                    <Bar dataKey="Full (v1.0)" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Min (v0.1)" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Zero" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-[#444] text-xs font-mono py-8">No data for this period</div>
              )}
            </div>

            {/* Weekly consistency */}
            {weeklyData.length > 0 && (
              <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-4 mb-6">
                <h3 className="text-xs text-ngtz-muted font-mono tracking-wider mb-4">WEEKLY NON-ZERO RATE</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: "#555", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#222" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={false} tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111", border: "1px solid #222",
                        borderRadius: "8px", fontSize: "11px", fontFamily: "JetBrains Mono",
                      }}
                      formatter={(value: number) => [`${value}%`, "Non-Zero Rate"]}
                    />
                    <Bar dataKey="rate" fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-habit breakdown */}
            <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-4">
              <h3 className="text-xs text-ngtz-muted font-mono tracking-wider mb-4">PER HABIT BREAKDOWN</h3>
              {habitStats.length === 0 && (
                <div className="text-center text-[#444] text-xs font-mono py-4">No habits tracked yet</div>
              )}
              <div className="space-y-4">
                {habitStats.map((h) => {
                  const total = h.green + h.yellow + h.red;
                  const greenPct = total > 0 ? (h.green / total) * 100 : 0;
                  const yellowPct = total > 0 ? (h.yellow / total) * 100 : 0;
                  const redPct = total > 0 ? (h.red / total) * 100 : 0;

                  return (
                    <div key={h.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{h.icon}</span>
                          <span className="text-sm text-gray-300 font-display">{h.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-ngtz-green">{h.streak}d streak</span>
                          <span className="text-[#444]">best: {h.longestStreak}d</span>
                        </div>
                      </div>

                      {/* Stacked bar */}
                      {total > 0 && (
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-[#111]">
                          {greenPct > 0 && (
                            <div className="bg-ngtz-green transition-all" style={{ width: `${greenPct}%` }} />
                          )}
                          {yellowPct > 0 && (
                            <div className="bg-ngtz-yellow transition-all" style={{ width: `${yellowPct}%` }} />
                          )}
                          {redPct > 0 && (
                            <div className="bg-ngtz-red transition-all" style={{ width: `${redPct}%` }} />
                          )}
                        </div>
                      )}

                      <div className="flex gap-4 mt-1.5 text-[10px] font-mono">
                        <span className="text-ngtz-green">🟢 {h.green}</span>
                        <span className="text-ngtz-yellow">🟡 {h.yellow}</span>
                        <span className="text-ngtz-red">🔴 {h.red}</span>
                        <span className="text-[#444] ml-auto">
                          {total > 0 ? Math.round(((h.green + h.yellow) / total) * 100) : 0}% non-zero
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-5 mt-6">
              {[
                { color: "bg-ngtz-green", label: "Full (v1.0)" },
                { color: "bg-ngtz-yellow", label: "Min (v0.1) — still a win" },
                { color: "bg-ngtz-red", label: "Zero" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={clsx("w-2.5 h-2.5 rounded-sm", item.color)} />
                  <span className="text-[9px] text-[#555] font-mono">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
