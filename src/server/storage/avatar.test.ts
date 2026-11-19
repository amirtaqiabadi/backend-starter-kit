import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = mocks.send; },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
}));
import { deleteAvatar } from "./avatar";

describe("deleting avatar objects", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("only deletes generated object keys owned by the current user", async () => {
    for (const [key, value] of Object.entries({ LIARA_ENDPOINT: "https://storage.example", LIARA_BUCKET_NAME: "bucket", LIARA_ACCESS_KEY: "key", LIARA_SECRET_KEY: "secret", LIARA_PUBLIC_URL: "https://cdn.example/base" })) vi.stubEnv(key, value);
    const id = "d4147a0a-20d8-4d1b-a9cd-1511d207b354.webp";
    await deleteAvatar(7, `https://cdn.example/base/avatars/7/${id}`);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0][0].input).toEqual({ Bucket: "bucket", Key: `avatars/7/${id}` });
    for (const url of [`https://cdn.example/base/avatars/8/${id}`, `https://evil.example/base/avatars/7/${id}`, "https://cdn.example/base/avatars/7/other.webp", `https://cdn.example/base/avatars/7/${id}?x=1`]) await deleteAvatar(7, url);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
});
