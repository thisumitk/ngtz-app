import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { habits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// PATCH /api/habits/[id] — update habit
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { name, icon, vFull, vMin, sortOrder } = body;

  if (
    (name !== undefined && name.length > 100) ||
    (icon !== undefined && icon.length > 10) ||
    (vFull !== undefined && vFull.length > 500) ||
    (vMin !== undefined && vMin.length > 500)
  ) {
    return NextResponse.json(
      { error: "Input too long" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (icon !== undefined) updates.icon = icon;
  if (vFull !== undefined) updates.vFull = vFull;
  if (vMin !== undefined) updates.vMin = vMin;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  const [updated] = await db
    .update(habits)
    .set(updates)
    .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/habits/[id] — soft delete (archive)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const [archived] = await db
    .update(habits)
    .set({ archived: new Date(), updatedAt: new Date() })
    .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)))
    .returning();

  if (!archived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
