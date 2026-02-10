import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyLogs, habits } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// GET /api/analytics?range=week|month|quarter|year&from=...&to=...
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "month";

  const now = new Date();
  let from: string;
  let to: string = now.toISOString().slice(0, 10);

  switch (range) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      from = d.toISOString().slice(0, 10);
      break;
    }
    case "month": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
      break;
    }
    case "quarter": {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      from = d.toISOString().slice(0, 10);
      break;
    }
    case "year": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      from = d.toISOString().slice(0, 10);
      break;
    }
    default:
      from = searchParams.get("from") || to;
  }

  // Allow override
  if (searchParams.get("from")) from = searchParams.get("from")!;
  if (searchParams.get("to")) to = searchParams.get("to")!;

  // ── Per-habit aggregates ───────────────────────────────────
  const aggregates = await db
    .select({
      habitId: dailyLogs.habitId,
      status: dailyLogs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, user.id),
        gte(dailyLogs.date, from),
        lte(dailyLogs.date, to)
      )
    )
    .groupBy(dailyLogs.habitId, dailyLogs.status);

  // ── Daily totals for chart (date, green_count, yellow_count, red_count) ──
  const dailyTotals = await db
    .select({
      date: dailyLogs.date,
      green: sql<number>`count(*) filter (where ${dailyLogs.status} = 'green')::int`,
      yellow: sql<number>`count(*) filter (where ${dailyLogs.status} = 'yellow')::int`,
      red: sql<number>`count(*) filter (where ${dailyLogs.status} = 'red')::int`,
    })
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, user.id),
        gte(dailyLogs.date, from),
        lte(dailyLogs.date, to)
      )
    )
    .groupBy(dailyLogs.date)
    .orderBy(dailyLogs.date);

  // ── Streaks (computed from all logs, not just range) ───────
  const userHabits = await db
    .select({ id: habits.id, name: habits.name, icon: habits.icon })
    .from(habits)
    .where(eq(habits.userId, user.id));

  const allLogs = await db
    .select({
      habitId: dailyLogs.habitId,
      date: dailyLogs.date,
      status: dailyLogs.status,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, user.id))
    .orderBy(desc(dailyLogs.date));

  // Calculate current streak per habit
  const streaks: Record<string, number> = {};
  const longestStreaks: Record<string, number> = {};

  for (const habit of userHabits) {
    const habitLogs = allLogs
      .filter((l) => l.habitId === habit.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Build a set of logged dates
    const logMap = new Map(habitLogs.map((l) => [l.date, l.status]));

    // Current streak
    let streak = 0;
    const d = new Date();
    const todayStr = d.toISOString().slice(0, 10);
    let checkDate = new Date(d);

    // If today not logged, start from yesterday
    if (!logMap.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const key = checkDate.toISOString().slice(0, 10);
      const status = logMap.get(key);
      if (status === "green" || status === "yellow") {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    streaks[habit.id] = streak;

    // Longest streak (scan all dates)
    let longest = 0;
    let current = 0;
    const sorted = [...habitLogs].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i].status;
      if (s === "green" || s === "yellow") {
        // Check if consecutive day
        if (i === 0) {
          current = 1;
        } else {
          const prev = new Date(sorted[i - 1].date);
          const curr = new Date(sorted[i].date);
          const diff =
            (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1 && (sorted[i - 1].status === "green" || sorted[i - 1].status === "yellow")) {
            current++;
          } else {
            current = 1;
          }
        }
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    longestStreaks[habit.id] = longest;
  }

  // ── Weekly summary (last 4 weeks) ─────────────────────────
  const weeklySummary = await db
    .select({
      week: sql<string>`to_char(${dailyLogs.date}::date, 'IYYY-IW')`,
      nonZero: sql<number>`count(*) filter (where ${dailyLogs.status} in ('green', 'yellow'))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, user.id),
        gte(dailyLogs.date, from),
        lte(dailyLogs.date, to)
      )
    )
    .groupBy(sql`to_char(${dailyLogs.date}::date, 'IYYY-IW')`)
    .orderBy(sql`to_char(${dailyLogs.date}::date, 'IYYY-IW')`);

  return NextResponse.json({
    range: { from, to },
    habits: userHabits,
    aggregates,
    dailyTotals,
    streaks,
    longestStreaks,
    weeklySummary,
  });
}
