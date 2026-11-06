import { randomBytes } from "node:crypto";
import { authConfig } from "@/server/config";
import { getRedis } from "@/server/redis";

export type SessionRecord = {
  sessionId: string;
  userId: number;
  createdAt: number;
  ip: string;
  userAgent: string;
};

type StoredSession = Omit<SessionRecord, "sessionId">;

const INVALIDATE_OTHERS = `
local current = ARGV[1]
local ids = redis.call('SMEMBERS', KEYS[1])
for _, id in ipairs(ids) do
  if id ~= current then
    redis.call('DEL', 'session:' .. id)
    redis.call('DEL', 'auth:reset:' .. id)
    redis.call('SREM', KEYS[1], id)
  end
end
return 1
`;

/** Why: each login gets a fresh 256-bit id so an old cookie cannot be reused as the new session. */
export async function createSession(input: {
  userId: number;
  ip: string;
  userAgent: string;
}): Promise<string> {
  const config = authConfig();
  const sessionId = randomBytes(32).toString("base64url");
  const stored: StoredSession = {
    userId: input.userId,
    createdAt: Date.now(),
    ip: input.ip,
    userAgent: input.userAgent,
  };
  const ttl = Math.min(config.sessionSlidingSeconds, config.sessionAbsoluteSeconds);
  const redis = getRedis();
  await redis
    .multi()
    .set(sessionKey(sessionId), JSON.stringify(stored), "EX", ttl)
    .sadd(userSessionsKey(input.userId), sessionId)
    .expire(userSessionsKey(input.userId), config.sessionAbsoluteSeconds)
    .exec();
  return sessionId;
}

/** Why: activity extends the session only until the absolute lifetime, and a non-numeric user id is a retired session. */
export async function readSession(sessionId: string | null): Promise<SessionRecord | null> {
  if (!sessionId) {
    return null;
  }
  const raw = await getRedis().get(sessionKey(sessionId));
  if (!raw) {
    return null;
  }
  const stored = JSON.parse(raw) as StoredSession;
  if (typeof stored.userId !== "number") {
    await getRedis().del(sessionKey(sessionId));
    return null;
  }
  const ageSeconds = Math.floor((Date.now() - stored.createdAt) / 1000);
  const remaining = authConfig().sessionAbsoluteSeconds - ageSeconds;
  if (remaining <= 0) {
    await destroySession({ sessionId, userId: stored.userId });
    return null;
  }
  const ttl = Math.min(authConfig().sessionSlidingSeconds, remaining);
  await getRedis().expire(sessionKey(sessionId), ttl);
  return { sessionId, ...stored };
}

/** Why: a password reset must keep the caller signed in and drop every other device. */
export async function invalidateOtherSessions(input: {
  userId: number;
  sessionId: string;
}): Promise<void> {
  await getRedis().eval(INVALIDATE_OTHERS, 1, userSessionsKey(input.userId), input.sessionId);
}

/** Why: reset is allowed only for the session that just proved the phone, and only once. */
export async function grantPasswordReset(sessionId: string): Promise<void> {
  await getRedis().set(resetKey(sessionId), "1", "EX", authConfig().resetTtlSeconds);
}

/** Why: consuming the flag and checking it must be one Redis operation. */
export async function consumePasswordReset(sessionId: string): Promise<boolean> {
  const value = await getRedis().getdel(resetKey(sessionId));
  return value !== null;
}

/** Why: an expired absolute session should not linger in the user's session set. */
async function destroySession(input: { sessionId: string; userId: number }): Promise<void> {
  const redis = getRedis();
  await redis.del(sessionKey(input.sessionId), resetKey(input.sessionId));
  await redis.srem(userSessionsKey(input.userId), input.sessionId);
}

/** Why: session payload keys stay in one place. */
function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

/** Why: bulk invalidation needs the set of ids that belong to one user. */
function userSessionsKey(userId: number): string {
  return `user:sessions:${userId}`;
}

/** Why: the reset permission is bound to a session id and nothing else. */
function resetKey(sessionId: string): string {
  return `auth:reset:${sessionId}`;
}
