import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), find: vi.fn(), remove: vi.fn(), upload: vi.fn(), rollback: vi.fn() }));
vi.mock("@/server/auth/require-session", () => ({ requireSession: mocks.session }));
vi.mock("@/server/db", () => ({ getPrisma: () => ({ user: { updateMany: mocks.update, findUnique: mocks.find } }) }));
vi.mock("@/server/storage/avatar", async (importOriginal) => ({ ...await importOriginal<typeof import("@/server/storage/avatar")>(), uploadAvatar: mocks.upload, deleteAvatar: mocks.remove }));
import { DELETE, POST } from "./route";

function request(file: Blob, options: { csrf?: boolean; origin?: string } = {}) {
  const form = new FormData();
  form.append("file", file, "avatar.png");
  return new Request("http://localhost:3000/api/v1/user/avatar", { method: "POST", headers: {
    origin: options.origin ?? "http://localhost:3000", cookie: "csrf-token=token",
    ...(options.csrf === false ? {} : { "x-csrf-token": "token" }),
  }, body: form });
}

describe("avatar upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ userId: 7 });
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.upload.mockResolvedValue({ url: "https://bucket.example/avatars/7/id.webp", rollback: mocks.rollback });
  });
  it("converts an image to WebP and saves its URL on the session user", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const response = await POST(request(new Blob([new Uint8Array(png)], { type: "image/png" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ avatarUrl: "https://bucket.example/avatars/7/id.webp" });
    expect((await sharp(mocks.upload.mock.calls[0][1]).metadata()).format).toBe("webp");
    expect(mocks.upload.mock.calls[0][0]).toBe(7);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { avatarUrl: "https://bucket.example/avatars/7/id.webp" } });
  });
  it("rejects invalid images, oversized files, and requests without authorization", async () => {
    expect((await POST(request(new Blob(["fake"], { type: "image/webp" })))).status).toBe(400);
    expect((await POST(request(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])))).status).toBe(413);
    expect((await POST(request(new Blob(["x"]), { csrf: false }))).status).toBe(403);
    expect((await POST(request(new Blob(["x"]), { origin: "https://evil.example" }))).status).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await POST(request(new Blob(["x"])))).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("removes the newly uploaded object when the database update fails", async () => {
    mocks.update.mockRejectedValue(new Error("database"));
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    expect((await POST(request(new Blob([new Uint8Array(png)])))).status).toBe(503);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
});


describe("avatar deletion", () => {
  const url = "https://bucket.example/avatars/7/123.webp";
  const del = (csrf = true, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/v1/user/avatar", {
    method: "DELETE", headers: { origin, cookie: "csrf-token=token", ...(csrf ? { "x-csrf-token": "token" } : {}) },
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ userId: 7 });
    mocks.find.mockResolvedValue({ avatarUrl: url });
    mocks.remove.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({ count: 1 });
  });
  it("deletes the current user's object and clears its profile", async () => {
    const response = await DELETE(del());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ avatarUrl: null });
    expect(mocks.remove).toHaveBeenCalledWith(7, url);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 7, avatarUrl: url }, data: { avatarUrl: null } });
  });
  it("is idempotent when no avatar exists", async () => {
    mocks.find.mockResolvedValue({ avatarUrl: null });
    expect((await DELETE(del())).status).toBe(200);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("protects the endpoint and does not clear the profile if storage fails", async () => {
    expect((await DELETE(del(false))).status).toBe(403);
    expect((await DELETE(del(true, "https://evil.example"))).status).toBe(403);
    mocks.session.mockResolvedValueOnce(null);
    expect((await DELETE(del())).status).toBe(401);
    mocks.remove.mockRejectedValueOnce(new Error("storage"));
    expect((await DELETE(del())).status).toBe(503);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not clear an avatar changed concurrently", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await DELETE(del())).status).toBe(409);
  });
});
