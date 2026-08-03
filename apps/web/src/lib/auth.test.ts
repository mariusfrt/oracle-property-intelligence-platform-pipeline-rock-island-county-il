import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "node:crypto";
import { verifyAccessToken } from "./auth";

describe("verifyAccessToken", () => {
  it("compares tokens in constant time when lengths match", () => {
    process.env.ACCESS_TOKEN = "demo-token-secret";
    expect(verifyAccessToken("demo-token-secret")).toBe(true);
    expect(verifyAccessToken("wrong-token-secret")).toBe(false);
  });

  it("rejects missing or empty tokens", () => {
    process.env.ACCESS_TOKEN = "demo-token-secret";
    expect(verifyAccessToken(undefined)).toBe(false);
    expect(verifyAccessToken("")).toBe(false);
  });

  it("rejects when lengths differ without throwing", () => {
    process.env.ACCESS_TOKEN = "short";
    expect(verifyAccessToken("much-longer-token")).toBe(false);
    const a = Buffer.from("a", "utf8");
    const b = Buffer.from("bb", "utf8");
    expect(a.length).not.toBe(b.length);
    expect(() => timingSafeEqual(a, b)).toThrow();
  });
});
