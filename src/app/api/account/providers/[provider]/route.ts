import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// DELETE /api/account/providers/[provider] — unlink a single OAuth provider
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Count linked accounts — cannot unlink the last one
  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, user.id));

  if (linked.length <= 1) {
    return NextResponse.json(
      { error: "Cannot unlink your only login method" },
      { status: 400 }
    );
  }

  await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.userId, user.id),
        eq(accounts.provider, params.provider)
      )
    );

  return NextResponse.json({ success: true });
}
