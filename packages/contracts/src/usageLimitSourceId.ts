import * as Schema from "effect/Schema";

// Separate module avoids an import cycle between settings and usage-limit contracts.
export const UsageLimitSourceId = Schema.String.pipe(Schema.brand("UsageLimitSourceId"));
export type UsageLimitSourceId = typeof UsageLimitSourceId.Type;

/** `cliproxy` pools a CLIProxyAPI hub's accounts; `zai` reads one Z.AI Coding Plan. */
export const UsageLimitSourceKind = Schema.Literals(["cliproxy", "zai"]);
export type UsageLimitSourceKind = typeof UsageLimitSourceKind.Type;
