"use client";

import { useState } from "react";
import type { Habit } from "@/lib/db/schema";

interface Props {
  habit?: Habit | null;
  onSave: (data: { name: string; icon: string; vFull: string; vMin: string }) => void;
  onCancel: () => void;
}

export function HabitForm({ habit, onSave, onCancel }: Props) {
  const [name, setName] = useState(habit?.name || "");
  const [icon, setIcon] = useState(habit?.icon || "🎯");
  const [vFull, setVFull] = useState(habit?.vFull || "");
  const [vMin, setVMin] = useState(habit?.vMin || "");

  const valid = name && vFull && vMin;

  const handleSubmit = () => {
    if (valid) onSave({ name, icon, vFull, vMin });
  };

  return (
    <div className="bg-ngtz-card border border-[#222] rounded-2xl p-5 mb-3.5">
      <div className="text-sm font-semibold text-gray-200 mb-4 font-display">
        {habit ? "Edit Habit" : "New Habit"}
      </div>

      <div className="flex gap-2.5 mb-3">
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🎯"
          className="w-14 px-2.5 py-2.5 bg-[#111] border border-ngtz-border rounded-lg
                     text-center text-xl font-mono text-gray-200 outline-none
                     focus:border-[#333] transition-colors"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name"
          className="flex-1 px-3 py-2.5 bg-[#111] border border-ngtz-border rounded-lg
                     text-sm font-mono text-gray-200 outline-none
                     focus:border-[#333] transition-colors"
        />
      </div>

      <input
        value={vFull}
        onChange={(e) => setVFull(e.target.value)}
        placeholder="Version 1.0 — Full version (e.g. 45 min workout)"
        className="w-full px-3 py-2.5 mb-2.5 bg-[#111] border border-ngtz-border rounded-lg
                   text-sm font-mono text-gray-200 outline-none
                   focus:border-[#333] transition-colors"
      />

      <input
        value={vMin}
        onChange={(e) => setVMin(e.target.value)}
        placeholder="Version 0.1 — Too small to fail (e.g. 10 pushups)"
        className="w-full px-3 py-2.5 mb-4 bg-[#111] border border-ngtz-border rounded-lg
                   text-sm font-mono text-gray-200 outline-none
                   focus:border-[#333] transition-colors"
      />

      <div className="flex gap-2.5">
        <button
          onClick={handleSubmit}
          disabled={!valid}
          className={`px-6 py-2.5 rounded-lg text-xs font-semibold font-display transition-all ${
            valid
              ? "bg-ngtz-green text-black hover:bg-green-400"
              : "bg-[#222] text-[#555] cursor-not-allowed"
          }`}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-lg text-xs text-[#666] border border-ngtz-border
                     font-display hover:border-[#333] transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
