import { authConfig } from "@/server/config";
import { readSession, type SessionRecord } from "@/server/auth/session";
import { readCookie } from "@/server/http";

/** Why: wallet routes take initiatorId only from the signed-in session cookie. */
export async function requireSession(request: Request): Promise<SessionRecord | null> {
  const sessionId = readCookie(request, authConfig().sessionCookieName);
  return readSession(sessionId);
}
