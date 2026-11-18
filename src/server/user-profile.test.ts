import { afterAll, describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/v1/user/route";
import { createSession } from "@/server/auth/session";
import { findOrCreateUserByPhone } from "@/server/auth/users";
import { getPrisma } from "@/server/db";
import { getRedis } from "@/server/redis";

function request(body: unknown, session = "", csrf = true, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/v1/user", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin,
      cookie: `session=${session}; csrf-token=test-token`,
      ...(csrf ? { "x-csrf-token": "test-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("user profile", () => {
  afterAll(async () => {
    await getPrisma().$disconnect();
    await getRedis().quit();
  });

  it("returns only the authenticated user's profile and password status", async () => {
    const user = await findOrCreateUserByPhone("09129999993");
    const token = (await getPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).token.trim();
    const session = await createSession({ userId: user.id, ip: "test", userAgent: "test" });
    const get = (id: string) => GET(new Request("http://localhost:3000/api/v1/user", {
      headers: { cookie: `session=${id}` },
    }));
    expect((await get("")).status).toBe(401);
    const initial = await get(session);
    expect(initial.status).toBe(200);
    expect(initial.headers.get("cache-control")).toBe("no-store");
    expect(await initial.json()).toEqual({ name: null, phoneNumber: "09129999993", avatarUrl: null, hasPassword: false, token, walletIds: [] });
    await getPrisma().user.update({ where: { id: user.id }, data: {
      name: "علی", avatarUrl: "https://example.com/avatar.png", passwordHash: "private-hash",
    } });
    const active = await getPrisma().team.create({ data: { members: { create: { userId: user.id, role: "member" } } } });
    const inactive = await getPrisma().team.create({ data: { isActive: false, members: { create: { userId: user.id } } } });
    expect(await (await get(session)).json()).toEqual({
      name: "علی", phoneNumber: "09129999993", avatarUrl: "https://example.com/avatar.png", hasPassword: true, token, walletIds: [active.id],
    });
    await getPrisma().teamMember.deleteMany({ where: { userId: user.id } });
    await getPrisma().team.deleteMany({ where: { id: { in: [active.id, inactive.id] } } });
    await getPrisma().user.delete({ where: { id: user.id } });
    expect((await get(session)).status).toBe(401);
  });

  it("updates only the signed-in user's name and rejects invalid or protected fields", async () => {
    const user = await findOrCreateUserByPhone("09129999991");
    const other = await findOrCreateUserByPhone("09129999992");
    const session = await createSession({ userId: user.id, ip: "test", userAgent: "test" });
    const response = await PATCH(request({ name: "  علی رضایی  " }, session));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "علی رضایی" });
    expect((await getPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("علی رضایی");
    expect((await getPrisma().user.findUniqueOrThrow({ where: { id: other.id } })).name).toBeNull();
    for (const body of [{}, { name: "  " }, { name: "x".repeat(81) }, { name: "test", phoneNumber: "09120000000" }]) {
      expect((await PATCH(request(body, session))).status).toBe(400);
    }
    expect((await getPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).phoneNumber).toBe("09129999991");
    expect((await PATCH(request({ name: "test" }))).status).toBe(401);
    expect((await PATCH(request({ name: "test" }, session, false))).status).toBe(403);
    expect((await PATCH(request({ name: "test" }, session, true, "https://example.com"))).status).toBe(403);
    await getPrisma().user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
  });
});
