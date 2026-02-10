"use client";

import { useState, useEffect, useCallback } from "react";
import type { DailyLog, LogStatus } from "@/lib/db/schema";

type LogMap = Record<string, Record<string, LogStatus>>; // date -> habitId -> status

export function useLogs(from?: string, to?: string) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logMap, setLogMap] = useState<LogMap>({});
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) {
        const data: DailyLog[] = await res.json();
        setLogs(data);

        // Build lookup map
        const map: LogMap = {};
        for (const log of data) {
          if (!map[log.date]) map[log.date] = {};
          map[log.date][log.habitId] = log.status as LogStatus;
        }
        setLogMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setStatus = useCallback(
    async (habitId: string, date: string, status: LogStatus | null) => {
      // Optimistic update
      setLogMap((prev) => {
        const updated = { ...prev };
        if (!status) {
          if (updated[date]) {
            const { [habitId]: _, ...rest } = updated[date];
            if (Object.keys(rest).length === 0) {
              delete updated[date];
            } else {
              updated[date] = rest;
            }
          }
        } else {
          updated[date] = { ...updated[date], [habitId]: status };
        }
        return updated;
      });

      // Persist
      await fetch("/api/logs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, date, status }),
      });
    },
    []
  );

  return { logs, logMap, loading, setStatus, refetch: fetchLogs };
}
