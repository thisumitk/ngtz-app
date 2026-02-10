"use client";

import { clsx } from "clsx";
import type { LogStatus } from "@/lib/db/schema";

const config: Record<
  string,
  { label: string; color: string; bg: string; ring: string }
> = {
  green: {
    label: "Full (v1.0)",
    color: "bg-ngtz-green",
    bg: "bg-green-950/50",
    ring: "ring-ngtz-green/30",
  },
  yellow: {
    label: "Min (v0.1)",
    color: "bg-ngtz-yellow",
    bg: "bg-yellow-950/50",
    ring: "ring-ngtz-yellow/30",
  },
  red: {
    label: "Zero",
    color: "bg-ngtz-red",
    bg: "bg-red-950/50",
    ring: "ring-ngtz-red/30",
  },
};

interface Props {
  status: LogStatus;
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

export function StatusButton({ status, active, onClick, size = "md" }: Props) {
  const cfg = config[status];
  const sizes = { sm: "w-7 h-7", md: "w-10 h-10", lg: "w-12 h-12" };
  const dotSizes = { sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5 h-5" };

  return (
    <button
      onClick={onClick}
      title={cfg.label}
      className={clsx(
        "rounded-full border-2 flex items-center justify-center transition-all duration-200",
        sizes[size],
        active
          ? `${cfg.bg} border-current ring-2 ${cfg.ring} status-active`
          : "border-[#333] hover:border-[#555]"
      )}
      style={active ? { borderColor: `var(--${status})` } : {}}
    >
      <div
        className={clsx(
          "rounded-full transition-all duration-200",
          dotSizes[size],
          active ? cfg.color : "bg-[#444]"
        )}
      />
    </button>
  );
}

export function StatusLabel({ status }: { status: LogStatus | null }) {
  if (!status) return <span className="text-[#444] text-xs font-mono">—</span>;

  const labels: Record<string, { text: string; color: string }> = {
    green: { text: "FULL ✓", color: "text-ngtz-green" },
    yellow: { text: "MIN ✓", color: "text-ngtz-yellow" },
    red: { text: "ZERO ✗", color: "text-ngtz-red" },
  };

  const l = labels[status];
  return (
    <span className={`${l.color} text-xs font-mono transition-colors`}>
      {l.text}
    </span>
  );
}
