import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits } from "@/lib/db/schema";
import { eq, asc, isNull } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// GET /api/habits — list all active habits for user
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const result = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, user.id))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));

  // Filter out archived in app layer for flexibility
  const active = result.filter((h) => !h.archived);

  return NextResponse.json(active);
}

// POST /api/habits — create a new habit
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { name, icon, vFull, vMin } = body;

  if (!name || !vFull || !vMin) {
    return NextResponse.json(
      { error: "name, vFull, vMin are required" },
      { status: 400 }
    );
  }

  // Get max sort order
  const existing = await db
    .select({ sortOrder: habits.sortOrder })
    .from(habits)
    .where(eq(habits.userId, user.id))
    .orderBy(asc(habits.sortOrder));

  const nextOrder =
    existing.length > 0
      ? Math.max(...existing.map((h) => h.sortOrder)) + 1
      : 0;

  const [created] = await db
    .insert(habits)
    .values({
      userId: user.id,
      name,
      icon: icon || "🎯",
      vFull,
      vMin,
      sortOrder: nextOrder,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
