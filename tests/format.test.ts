import { describe, expect, it } from "vitest";

import { oppositeOf } from "@/lib/bets";
import { formatRelative, initialsOf } from "@/lib/format";

describe("format", () => {
  it("formats relative times against a given clock", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    expect(formatRelative("2026-11-20T11:59:50Z", now)).toBe("just now");
    expect(formatRelative("2026-11-20T11:55:00Z", now)).toMatch(/5 minutes ago/);
    expect(formatRelative("2026-11-20T09:00:00Z", now)).toMatch(/3 hours ago/);
  });

  it("builds initials", () => {
    expect(initialsOf("ana maria lopez")).toBe("AM");
    expect(initialsOf("")).toBe("?");
  });

  it("flips sides", () => {
    expect(oppositeOf("YES")).toBe("NO");
  });
});
