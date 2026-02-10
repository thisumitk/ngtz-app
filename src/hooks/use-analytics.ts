"use client";

import { useState, useEffect, useCallback } from "react";

export interface AnalyticsData {
  range: { from: string; to: string };
  habits: { id: string; name: string; icon: string }[];
  aggregates: { habitId: string; status: string; count: number }[];
  dailyTotals: { date: string; green: number; yellow: number; red: number }[];
  streaks: Record<string, number>;
  longestStreaks: Record<string, number>;
  weeklySummary: { week: string; nonZero: number; total: number }[];
}

export function useAnalytics(range: string = "month") {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, refetch: fetchAnalytics };
}
