"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { HabitCard } from "@/components/habit-card";
import { HabitForm } from "@/components/habit-form";
import { useHabits } from "@/hooks/use-habits";
import { useLogs } from "@/hooks/use-logs";
import type { Habit, LogStatus } from "@/lib/db/schema";
import { getLocalDateStr, getLocalDateStrDaysAgo } from "@/lib/date";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Load logs for past 90 days (covers calendar navigation)
  const from = useMemo(() => getLocalDateStrDaysAgo(90), []);
  const to = useMemo(() => getLocalDateStr(), []);

  const { habits, loading: habitsLoading, createHabit, updateHabit, deleteHabit } = useHabits();
  const { logMap, loading: logsLoading, setStatus } = useLogs(from, to);

  if (status === "unauthenticated") redirect("/login");

  const todayStr = getLocalDateStr();
  const todayDone = habits.filter((h) => {
    const s = logMap[todayStr]?.[h.id];
    return s === "green" || s === "yellow";
  }).length;

  const handleSave = async (data: { name: string; icon: string; vFull: string; vMin: string }) => {
    if (editingHabit) {
      await updateHabit(editingHabit.id, data);
    } else {
      await createHabit(data);
    }
    setShowForm(false);
    setEditingHabit(null);
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteHabit(id);
  };

  const loading = habitsLoading || logsLoading || status === "loading";

  return (
    <div className="min-h-screen bg-ngtz-bg">
      <Navbar />

      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] tracking-[6px] text-[#444] mb-2 font-mono">
            NEVER GO TO ZERO
          </p>
          <h1 className="text-2xl font-bold text-gray-200 font-display tracking-tight">
            NGTZ Tracker
          </h1>
          <p className="text-[11px] text-ngtz-muted mt-2 font-mono">
            Yellow is a win. The streak stays alive.
          </p>
        </div>

        {/* Today's summary */}
        <div className="bg-ngtz-card border border-ngtz-border rounded-2xl p-4 px-5 mb-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-ngtz-muted font-mono tracking-widest">
              TODAY
            </div>
            <div className="text-sm text-[#999] mt-1 font-mono">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-bold font-display ${
                todayDone === habits.length && habits.length > 0
                  ? "text-ngtz-green"
                  : todayDone > 0
                  ? "text-ngtz-yellow"
                  : "text-[#555]"
              }`}
            >
              {todayDone}/{habits.length}
            </div>
            <div className="text-[9px] text-ngtz-muted font-mono">NON-ZERO</div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center text-ngtz-muted text-sm font-mono py-12">
            Loading...
          </div>
        )}

        {/* Habit cards */}
        {!loading &&
          habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              logMap={logMap}
              onStatusChange={setStatus}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

        {/* Empty state */}
        {!loading && habits.length === 0 && !showForm && (
          <div className="text-center py-16">
            <div className="text-2xl mb-3">🎯</div>
            <div className="text-sm text-[#666] font-mono mb-1">No habits yet</div>
            <div className="text-xs text-[#444] font-mono">
              Add your first habit — make it embarrassingly easy.
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <HabitForm
            habit={editingHabit}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingHabit(null);
            }}
          />
        )}

        {/* Add button */}
        {!showForm && (
          <button
            onClick={() => {
              setEditingHabit(null);
              setShowForm(true);
            }}
            className="w-full py-3.5 border border-dashed border-[#222] rounded-2xl
                       text-[#444] text-sm font-display flex items-center justify-center gap-2
                       hover:border-[#333] hover:text-[#666] transition-all"
          >
            <Plus size={16} />
            Add Habit
          </button>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-[#282828] mt-10 font-mono">
          Version 0.1 isn&apos;t a backup plan. It&apos;s THE plan.
        </p>
      </div>
    </div>
  );
}
