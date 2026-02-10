import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUser, unauthorized } from "@/lib/session";

// GET /api/account — return user info + linked providers
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const [dbUser] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, user.id));

  const linkedAccounts = await db
    .select({
      provider: accounts.provider,
      providerAccountId: accounts.providerAccountId,
    })
    .from(accounts)
    .where(eq(accounts.userId, user.id));

  return NextResponse.json({
    user: dbUser,
    providers: linkedAccounts,
  });
}

// DELETE /api/account — delete entire account (cascade handles related data)
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  if (!body.confirm) {
    return NextResponse.json(
      { error: "Confirmation required" },
      { status: 400 }
    );
  }

  await db.delete(users).where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
