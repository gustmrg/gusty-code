import {
  ProviderDriverKind,
  UsageLimitSourceError,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
  type UsageLimitSourceAccount,
} from "@t3tools/contracts";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";

/** An API base with its key already read from wherever the setting keeps it. */
export interface ZaiPlan {
  readonly url: string;
  readonly apiKey: string;
}

const ZAI_DRIVER = ProviderDriverKind.make("zai");
// Clients name an account without e-mail by its id.
const ACCOUNT_ID = "GLM Coding Plan";

const QuotaLimit = Schema.Struct({
  type: Schema.String,
  unit: Schema.Number,
  number: Schema.optional(Schema.Number),
  usage: Schema.optional(Schema.Finite),
  remaining: Schema.optional(Schema.Finite),
  percentage: Schema.optional(Schema.Finite),
  nextResetTime: Schema.optional(Schema.NullOr(Schema.Finite)),
});
export const ZaiQuotaResponse = Schema.Struct({
  code: Schema.Literal(200),
  success: Schema.Literal(true),
  data: Schema.Struct({
    level: Schema.optional(Schema.String),
    limits: Schema.Array(QuotaLimit),
  }),
});
const ResetCard = Schema.Struct({
  available: Schema.Boolean,
  expireTime: Schema.optional(Schema.NullOr(Schema.String)),
});
export const ZaiResetResponse = Schema.Struct({
  code: Schema.Literal(200),
  success: Schema.Literal(true),
  data: Schema.Struct({
    fiveHourResets: Schema.optional(Schema.Array(ResetCard)),
    weekResets: Schema.optional(Schema.Array(ResetCard)),
  }),
});
const decodeQuota = Schema.decodeUnknownEffect(ZaiQuotaResponse);
const decodeResets = Schema.decodeUnknownEffect(ZaiResetResponse);

/** Z.AI's timezone-less expiry strings are on the Singapore clock, not the host's clock. */
function cardExpiry(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return undefined;
  const parsed = DateTime.make(`${value.replace(" ", "T")}+08:00`);
  return Option.isSome(parsed) ? DateTime.formatIso(parsed.value) : undefined;
}

// Cards carry no id to redeem with, so clients show the count without offering a reset.
function resetCredits(resets: typeof ZaiResetResponse.Type, checkedAt: string) {
  const now = DateTime.toEpochMillis(DateTime.makeUnsafe(checkedAt));
  const available = [...(resets.data.fiveHourResets ?? []), ...(resets.data.weekResets ?? [])]
    .filter((card) => card.available)
    .map((card) => cardExpiry(card.expireTime))
    .filter(
      (expiry) => expiry === undefined || DateTime.toEpochMillis(DateTime.makeUnsafe(expiry)) > now,
    );
  const nextExpiresAt = available.filter((expiry) => expiry !== undefined).toSorted()[0];
  return { availableCount: available.length, ...(nextExpiresAt ? { nextExpiresAt } : {}) };
}

export function zaiQuotaToLimits(
  quota: typeof ZaiQuotaResponse.Type,
  resets: typeof ZaiResetResponse.Type | undefined,
  checkedAt: string,
): ServerProviderUsageLimits {
  const windows = quota.data.limits.flatMap((limit): ServerProviderUsageWindow[] => {
    if (!["CREDIT_LIMIT", "TOKENS_LIMIT", "TIME_LIMIT"].includes(limit.type)) return [];
    const kind =
      limit.unit === 3 && (limit.number === undefined || limit.number === 5)
        ? "session"
        : limit.unit === 6 && (limit.number === undefined || limit.number === 1)
          ? "weekly"
          : limit.unit === 5 && limit.type === "TIME_LIMIT"
            ? "monthly"
            : undefined;
    if (!kind) return [];
    // The percentage is coarse: one credit out of 10,000 can report 1%.
    const usedPercent =
      limit.type === "CREDIT_LIMIT" &&
      limit.usage !== undefined &&
      limit.usage > 0 &&
      limit.remaining !== undefined &&
      limit.remaining >= 0
        ? (1 - limit.remaining / limit.usage) * 100
        : limit.percentage;
    if (usedPercent === undefined) return [];
    const reset = limit.nextResetTime ? DateTime.make(limit.nextResetTime) : Option.none();
    return [
      {
        id: `zai_${kind}`,
        kind,
        label: kind === "session" ? "Session" : kind === "weekly" ? "Weekly" : "Monthly tools",
        usedPercent: clampPercent(usedPercent),
        ...(kind === "session"
          ? { windowDurationMins: 300 }
          : kind === "weekly"
            ? { windowDurationMins: 10080 }
            : {}),
        ...(Option.isSome(reset) ? { resetsAt: DateTime.formatIso(reset.value) } : {}),
      },
    ];
  });
  if (windows.length === 0) {
    return makeUnavailableUsageLimits({
      checkedAt,
      reason: "probeFailed",
      message: "Z.AI reported no recognized quota windows.",
    });
  }
  return {
    ...makeUsageLimits({ checkedAt, windows }),
    ...(resets ? { resetCredits: resetCredits(resets, checkedAt) } : {}),
  };
}

function planLabel(level: string | undefined) {
  const trimmed = level?.trim();
  return trimmed
    ? `GLM ${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`
    : undefined;
}

export const makeZaiApi = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const digest = yield* Digest.Digest;

  /** Reads quota and reset-card inventory only; never grants or spends reset cards. */
  const readAccount = Effect.fn("ZaiApi.readAccount")(function* (
    plan: ZaiPlan,
  ): Effect.fn.Return<UsageLimitSourceAccount, UsageLimitSourceError> {
    const origin = URL.parse(plan.url)?.origin;
    if (!origin || !/^https?:/.test(origin)) {
      return yield* new UsageLimitSourceError({ detail: "The Z.AI API URL is not valid." });
    }
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    // Lets a failed read keep the last good one for the same key without exposing the key.
    const credentialFingerprint = yield* digest.digestHex(
      Digest.sha256,
      new TextEncoder().encode(`zai-coding-plan\0${plan.apiKey}`),
    );
    const get = (path: string) =>
      client
        .execute(
          HttpClientRequest.get(`${origin}/api/${path}`).pipe(
            HttpClientRequest.bearerToken(plan.apiKey),
          ),
        )
        .pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.json),
          Effect.timeout("15 seconds"),
        );
    return yield* Effect.all(
      {
        quota: get("monitor/usage/quota/limit").pipe(Effect.flatMap(decodeQuota)),
        resets: get("biz/customer-package-reset/list?targetType=PERSONAL").pipe(
          Effect.flatMap(decodeResets),
          Effect.orElseSucceed(() => undefined),
        ),
      },
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map(({ quota, resets }) => {
        const label = planLabel(quota.data.level);
        return {
          id: ACCOUNT_ID,
          driver: ZAI_DRIVER,
          ...(label ? { plan: label } : {}),
          usageLimits: { ...zaiQuotaToLimits(quota, resets, checkedAt), credentialFingerprint },
        };
      }),
      Effect.orElseSucceed(() => ({
        id: ACCOUNT_ID,
        driver: ZAI_DRIVER,
        usageLimits: {
          ...makeUnavailableUsageLimits({
            checkedAt,
            reason: "probeFailed",
            message: "Z.AI could not read GLM Coding Plan usage.",
          }),
          credentialFingerprint,
        },
      })),
    );
  });

  return { readAccount };
});
