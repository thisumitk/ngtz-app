import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyLogs, habits } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// GET /api/logs?from=2025-01-01&to=2025-01-31
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(dailyLogs.userId, user.id)];
  if (from) conditions.push(gte(dailyLogs.date, from));
  if (to) conditions.push(lte(dailyLogs.date, to));

  const result = await db
    .select()
    .from(dailyLogs)
    .where(and(...conditions))
    .orderBy(dailyLogs.date);

  return NextResponse.json(result);
}

// PUT /api/logs — upsert a daily log (idempotent)
// Body: { habitId, date, status, note? }
// If status is null/undefined, delete the log
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { habitId, date, status, note } = body;

  if (!habitId || !date) {
    return NextResponse.json(
      { error: "habitId and date are required" },
      { status: 400 }
    );
  }

  // A log's user and habit must have the same owner. Check before either
  // mutation, including writes to any inconsistent rows created previously.
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)))
    .limit(1);

  if (!habit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete case
  if (!status) {
    await db
      .delete(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, user.id),
          eq(dailyLogs.habitId, habitId),
          eq(dailyLogs.date, date)
        )
      );
    return NextResponse.json({ deleted: true });
  }

  // Validate status
  if (!["green", "yellow", "red"].includes(status)) {
    return NextResponse.json(
      { error: "status must be green, yellow, or red" },
      { status: 400 }
    );
  }

  // Upsert — ON CONFLICT on (userId, habitId, date)
  const [result] = await db
    .insert(dailyLogs)
    .values({
      userId: user.id,
      habitId,
      date,
      status,
      note: note || null,
    })
    .onConflictDoUpdate({
      target: [dailyLogs.userId, dailyLogs.habitId, dailyLogs.date],
      set: {
        status,
        note: note || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(result);
}
