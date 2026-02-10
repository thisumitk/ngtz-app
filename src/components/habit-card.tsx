"use client";

import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { Habit, LogStatus } from "@/lib/db/schema";
import { StatusButton, StatusLabel } from "./status-button";
import { MiniCalendar } from "./mini-calendar";

interface Props {
  habit: Habit;
  logMap: Record<string, Record<string, LogStatus>>;
  onStatusChange: (habitId: string, date: string, status: LogStatus | null) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(logMap: Record<string, Record<string, LogStatus>>, habitId: string): number {
  let streak = 0;
  const d = new Date();
  const todayStr = getToday();

  if (!logMap[todayStr]?.[habitId]) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = d.toISOString().slice(0, 10);
    const status = logMap[key]?.[habitId];
    if (status === "green" || status === "yellow") {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function calcStats(logMap: Record<string, Record<string, LogStatus>>, habitId: string) {
  let green = 0, yellow = 0, red = 0;
  for (const date in logMap) {
    const s = logMap[date]?.[habitId];
    if (s === "green") green++;
    else if (s === "yellow") yellow++;
    else if (s === "red") red++;
  }
  return { green, yellow, red, nonZero: green + yellow };
}

export function HabitCard({ habit, logMap, onStatusChange, onEdit, onDelete }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const todayStr = getToday();
  const currentStatus = logMap[todayStr]?.[habit.id] || null;
  const streak = useMemo(() => calcStreak(logMap, habit.id), [logMap, habit.id]);
  const stats = useMemo(() => calcStats(logMap, habit.id), [logMap, habit.id]);

  const toggleStatus = (status: LogStatus) => {
    onStatusChange(habit.id, todayStr, currentStatus === status ? null : status);
  };

  const cycleCalendarStatus = (date: string) => {
    const current = logMap[date]?.[habit.id] || null;
    const order: (LogStatus | null)[] = [null, "green", "yellow", "red"];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    onStatusChange(habit.id, date, next);
  };

  return (
    <div className="bg-ngtz-card border border-ngtz-border rounded-2xl p-5 mb-3.5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{habit.icon}</span>
          <div>
            <div className="text-base font-semibold text-gray-200 font-display">
              {habit.name}
            </div>
            <div className="text-[11px] text-ngtz-muted mt-0.5 font-mono">
              v1.0: {habit.vFull} · v0.1: {habit.vMin}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(habit)}
            className="p-2 text-[#444] hover:text-[#888] transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(habit.id)}
            className="p-2 text-[#444] hover:text-ngtz-red transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Today's status */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] text-ngtz-muted font-mono w-12 tracking-widest">
          TODAY
        </span>
        {(["green", "yellow", "red"] as LogStatus[]).map((s) => (
          <StatusButton
            key={s}
            status={s}
            active={currentStatus === s}
            onClick={() => toggleStatus(s)}
          />
        ))}
        <span className="ml-2">
          <StatusLabel status={currentStatus} />
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-5 mb-3">
        {[
          { label: "STREAK", value: streak, suffix: "d", color: streak > 0 ? "text-ngtz-green" : "text-[#555]" },
          { label: "NON-ZERO", value: stats.nonZero, suffix: "d", color: "text-ngtz-yellow" },
          { label: "🟢", value: stats.green, color: "text-ngtz-green" },
          { label: "🟡", value: stats.yellow, color: "text-ngtz-yellow" },
          { label: "🔴", value: stats.red, color: "text-ngtz-red" },
        ].map((s, i) => (
          <div key={i} className="text-center">
            <div className={clsx("text-lg font-bold font-display", s.color)}>
              {s.value}
              {s.suffix || ""}
            </div>
            <div className="text-[9px] text-ngtz-muted font-mono mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar toggle */}
      <button
        onClick={() => setShowCalendar(!showCalendar)}
        className="flex items-center gap-1.5 text-[11px] text-ngtz-muted font-mono
                   border border-ngtz-border rounded-lg px-3 py-1.5
                   hover:border-[#333] transition-all"
      >
        {showCalendar ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {showCalendar ? "Hide Calendar" : "Show Calendar"}
      </button>

      {showCalendar && (
        <div className="mt-4">
          <MiniCalendar
            logMap={logMap}
            habitId={habit.id}
            onToggle={cycleCalendarStatus}
          />
        </div>
      )}
    </div>
  );
}
