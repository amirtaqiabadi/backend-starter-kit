import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/domain/redirect";

describe("safeNextPath", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com/phish")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
  });
});
