import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PAST_OWNER_EMAIL } from "@/lib/past-owner";

export function isPastOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email === PAST_OWNER_EMAIL;
}

export async function resolvePastOwnerUserId(): Promise<string | null> {
  const owner = await db.query.users.findFirst({
    where: eq(users.email, PAST_OWNER_EMAIL),
  });
  return owner?.id ?? null;
}
