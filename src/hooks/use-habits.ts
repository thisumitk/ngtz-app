"use client";

import { useState, useEffect, useCallback } from "react";
import type { Habit } from "@/lib/db/schema";

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch("/api/habits");
      if (res.ok) {
        setHabits(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const createHabit = useCallback(
    async (data: { name: string; icon: string; vFull: string; vMin: string }) => {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setHabits((prev) => [...prev, created]);
        return created;
      }
    },
    []
  );

  const updateHabit = useCallback(
    async (id: string, data: Partial<Habit>) => {
      const res = await fetch(`/api/habits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
        return updated;
      }
    },
    []
  );

  const deleteHabit = useCallback(async (id: string) => {
    const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
    if (res.ok) {
      setHabits((prev) => prev.filter((h) => h.id !== id));
    }
  }, []);

  return { habits, loading, createHabit, updateHabit, deleteHabit, refetch: fetchHabits };
}
