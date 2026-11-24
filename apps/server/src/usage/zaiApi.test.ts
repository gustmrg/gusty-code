import { describe, expect, it } from "@effect/vitest";
import { ServerProviderUsageLimits } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { zaiQuotaToLimits } from "./zaiApi.ts";

const decodeLimits = Schema.decodeUnknownSync(ServerProviderUsageLimits);

const quota = {
  code: 200,
  success: true,
  data: {
    level: "lite",
    limits: [
      { type: "CREDIT_LIMIT", unit: 3, number: 5, usage: 2000, remaining: 1200, percentage: 40 },
      {
        type: "CREDIT_LIMIT",
        unit: 6,
        number: 1,
        usage: 10000,
        remaining: 9999,
        percentage: 1,
        nextResetTime: 1791573219983,
      },
    ],
  },
} as const;
const resets = {
  code: 200,
  success: true,
  data: {
    fiveHourResets: [
      { available: true, expireTime: "2026-10-30 07:35:06" },
      { available: true, expireTime: "2026-10-18 20:31:48" },
      { available: false, expireTime: "2026-10-30 07:35:06" },
      { available: true, expireTime: "2026-10-01 00:00:00" },
    ],
    weekResets: [{ available: true, expireTime: "2026-10-30 07:35:06" }],
  },
} as const;
const checkedAt = "2026-10-04T12:00:00.000Z";

describe("Z.AI Coding Plan limits", () => {
  it("maps credit windows and counts unexpired reset cards on the Singapore clock", () => {
    const limits = decodeLimits(zaiQuotaToLimits(quota, resets, checkedAt));
    expect(limits.windows[0]).toMatchObject({
      id: "zai_session",
      kind: "session",
      usedPercent: 40,
      windowDurationMins: 300,
    });
    expect(limits.windows[0]?.resetsAt).toBeUndefined();
    expect(limits.windows[1]).toMatchObject({
      id: "zai_weekly",
      kind: "weekly",
      windowDurationMins: 10080,
      resetsAt: "2026-10-09T19:13:39.983Z",
    });
    // The coarse percentage says 1%; the credit counts say one in ten thousand.
    expect(limits.windows[1]?.usedPercent).toBeCloseTo(0.01);
    // No credit id is reported, so clients cannot offer to redeem a card.
    expect(limits.resetCredits).toEqual({
      availableCount: 3,
      nextExpiresAt: "2026-10-18T12:31:48.000Z",
    });
  });

  it("tells an empty card inventory from an unread one and rejects unknown windows", () => {
    expect(
      zaiQuotaToLimits(quota, { code: 200, success: true, data: { fiveHourResets: [] } }, checkedAt)
        .resetCredits,
    ).toEqual({ availableCount: 0 });
    expect(zaiQuotaToLimits(quota, undefined, checkedAt).resetCredits).toBeUndefined();
    const future = {
      ...quota,
      data: { limits: [{ type: "CREDIT_LIMIT", unit: 99, number: 1, percentage: 0 }] },
    };
    expect(zaiQuotaToLimits(future, undefined, checkedAt).unavailable?.reason).toBe("probeFailed");
  });
});
