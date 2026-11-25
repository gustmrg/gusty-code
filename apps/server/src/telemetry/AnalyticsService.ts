// Gusty Code sends no product analytics. Upstream code keeps this service's shape, so every event is dropped.
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export interface TelemetryOwner {
  readonly source: string;
  readonly ownerId: string;
}

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  {
    /** Whether the event was queued to send; always false here. */
    readonly record: (
      event: string,
      properties?: Readonly<Record<string, unknown>>,
      options?: { readonly anonymous?: boolean },
    ) => Effect.Effect<boolean>;
    readonly flush: Effect.Effect<void>;
    readonly recordOwners: (
      owners: ReadonlyArray<TelemetryOwner>,
      observedBy: "server" | "client",
    ) => Effect.Effect<void>;
  }
>()("t3/telemetry/AnalyticsService") {}

export const layer = Layer.succeed(
  AnalyticsService,
  AnalyticsService.of({
    record: Effect.fn("AnalyticsService.record")(() => Effect.succeed(false)),
    flush: Effect.void,
    recordOwners: Effect.fn("AnalyticsService.recordOwners")(() => Effect.void),
  }),
);
