import type {
  EnvironmentId,
  SecretReference,
  UnifiedSettings,
  UsageLimitSourceKind,
} from "@t3tools/contracts";
import { T, useGT, Var } from "gt-react";
import { useId, useState } from "react";

import { useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import {
  CLI_PROXY_SOURCE_NAME,
  sourceIdFromUrl,
  ZAI_DEFAULT_URL,
  ZAI_SOURCE_NAME,
} from "./AddUsageLimitSourceDialog.logic";
import { SecretSourceInput, useSecretSources } from "./SecretSourceInput";
import { Label } from "../ui/label";

/** Send the key once to server secret storage; settings retain only a redaction marker. */
export function AddUsageLimitSourceDialog({
  open,
  onOpenChange,
  environmentId,
  environmentLabel,
  sources,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly sources: UnifiedSettings["usageLimitSources"];
}) {
  const gt = useGT();
  const formId = useId();
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const [kind, setKind] = useState<UsageLimitSourceKind>("cliproxy");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const secretSources = useSecretSources(environmentId);
  const [keyDraft, setKeyDraft] = useState<string | SecretReference>("");
  const [keyValid, setKeyValid] = useState(true);
  const managementKey = typeof keyDraft === "string" ? keyDraft.trim() : keyDraft;
  const trimmedUrl = url.trim();
  const canSave = keyValid && trimmedUrl.length > 0 && managementKey !== "";

  const reset = () => {
    setKind("cliproxy");
    setLabel("");
    setUrl("");
    setKeyDraft("");
    setKeyValid(true);
  };

  const save = () => {
    if (!canSave) return;
    const id = sourceIdFromUrl(trimmedUrl, sources, kind);
    updateSettings({
      usageLimitSources: {
        [id]: {
          kind,
          ...(label.trim() ? { label: label.trim() } : {}),
          url: trimmedUrl,
          managementKey,
          enabled: true,
        },
      },
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind === "zai" ? <T>Add a Z.AI Coding Plan</T> : <T>Add a CLIProxyAPI hub</T>}
          </DialogTitle>
          <DialogDescription>
            {kind === "zai" ? (
              gt(
                "Show the GLM Coding Plan quota and reset cards on {environment}. The key stays on that server.",
                { environment: environmentLabel },
              )
            ) : (
              <T>
                Show the quota of every account the hub pools, next to the providers on{" "}
                <Var>{environmentLabel}</Var>. The key stays on that server.
              </T>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            id={formId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <ToggleGroup
              aria-label={gt("Hub type")}
              variant="segmented"
              value={[kind]}
              onValueChange={(next) => {
                const value = next[0];
                if (value !== "cliproxy" && value !== "zai") return;
                setKind(value);
                // Prefill Z.AI's API, and drop it again when the user did not change it.
                if (value === "zai" && url.trim() === "") setUrl(ZAI_DEFAULT_URL);
                if (value === "cliproxy" && url === ZAI_DEFAULT_URL) setUrl("");
              }}
            >
              <Toggle value="cliproxy">{CLI_PROXY_SOURCE_NAME}</Toggle>
              <Toggle value="zai">{ZAI_SOURCE_NAME}</Toggle>
            </ToggleGroup>
            <div className="grid gap-1.5">
              <Label htmlFor="usage-source-url">
                {kind === "zai" ? <T>Base URL</T> : <T>Hub URL</T>}
              </Label>
              <Input
                id="usage-source-url"
                placeholder={kind === "zai" ? ZAI_DEFAULT_URL : "https://hub.example.ts.net:8318"}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                autoFocus
              />
              {kind === "zai" ? (
                <p className="text-xs text-muted-foreground">
                  {gt("Use {url} for a plan bought on the China mainland site.", {
                    url: "https://open.bigmodel.cn",
                  })}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="usage-source-key">
                {kind === "zai" ? gt("API key") : <T>Management key</T>}
              </Label>
              <SecretSourceInput
                id="usage-source-key"
                aria-label={kind === "zai" ? gt("API key") : gt("Management key")}
                value={keyDraft}
                sources={secretSources}
                environmentId={environmentId}
                onChange={(event) => setKeyDraft(event.target.value)}
                onSecretChange={(secret) => setKeyDraft(secret ?? "")}
                onValidityChange={setKeyValid}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="usage-source-label">
                <T>Label (optional)</T>
              </Label>
              <Input
                id="usage-source-label"
                placeholder={
                  kind === "zai"
                    ? gt("Defaults to {name}", { name: ZAI_SOURCE_NAME })
                    : gt("Defaults to the hub's host name")
                }
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          </form>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            <T>Cancel</T>
          </Button>
          <Button type="submit" form={formId} disabled={!canSave}>
            <T>Add hub</T>
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
