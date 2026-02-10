"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LogStatus } from "@/lib/db/schema";
import { getLocalDateStr } from "@/lib/date";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const statusColors: Record<string, { bg: string; text: string }> = {
  green: { bg: "bg-green-950/60", text: "text-ngtz-green" },
  yellow: { bg: "bg-yellow-950/60", text: "text-ngtz-yellow" },
  red: { bg: "bg-red-950/60", text: "text-ngtz-red" },
};

interface Props {
  logMap: Record<string, Record<string, LogStatus>>;
  habitId: string;
  onToggle: (date: string) => void;
}

export function MiniCalendar({ logMap, habitId, onToggle }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = getLocalDateStr(now);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <button onClick={prevMonth} className="text-[#666] hover:text-[#999] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-[#999] font-display min-w-[140px] text-center">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} className="text-[#666] hover:text-[#999] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 justify-items-center">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="w-8 h-5 flex items-center justify-center text-[10px] text-[#444] font-mono">
            {l}
          </div>
        ))}

        {/* Empty cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e-${i}`} className="w-8 h-8" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const status = logMap[dateStr]?.[habitId];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const sc = status ? statusColors[status] : null;

          return (
            <button
              key={d}
              onClick={isFuture ? undefined : () => onToggle(dateStr)}
              disabled={isFuture}
              className={clsx(
                "w-8 h-8 rounded-md text-[11px] font-mono flex items-center justify-center transition-all",
                isToday && "ring-1 ring-[#555]",
                isFuture && "opacity-20 cursor-default",
                !isFuture && !status && "text-[#555] hover:bg-[#151515]",
                sc && `${sc.bg} ${sc.text}`,
                isToday && "font-bold"
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3">
        {(["green", "yellow", "red"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={clsx("w-2 h-2 rounded-sm", `bg-ngtz-${s}`)} />
            <span className="text-[9px] text-[#555] font-mono">
              {s === "green" ? "Full" : s === "yellow" ? "Min" : "Zero"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
