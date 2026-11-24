<h1 align="center">Gusty Code</h1>

<p align="center">A personal, privacy-focused fork of <a href="https://github.com/pingdotgg/t3code">T3 Code</a>.</p>

Gusty Code runs the coding agents on your machine and gives them one fast interface. It is built on T3 Code, the open-source control plane for coding agents, and tracks its stable releases.

It works with the same agents T3 Code supports: Claude Code, Codex, Cursor, OpenCode, Grok Build, Antigravity, Kiro, Pi, Muse Code, fx, and any [ACP](./docs/user/providers-acp.md) agent.

## Build from source

Gusty Code uses [Vite+](https://viteplus.dev/guide/). Install its `vp` command, which also provides the pinned Node version:

```sh
curl -fsSL https://vite.plus | bash
```

On Windows, in PowerShell:

```powershell
irm https://vite.plus/ps1 | iex
```

Then, from the repository root:

```sh
vp i
vp run dev
```

Open the pairing URL printed by the dev runner. The [development runbook](./docs/operations/development.md) covers the details.

You need at least one agent installed and signed in, for example [Claude Code](https://claude.com/product/claude-code) with `claude auth login` or [Codex CLI](https://developers.openai.com/codex/cli) with `codex login`. See [provider setup](./docs/user/install.md#providers).

## Documentation

The [docs](./docs/README.md) come from T3 Code and describe this fork too, except where they mention official downloads, app stores, or T3 Connect. [Tracking upstream](./docs/operations/gusty-fork.md) explains how the fork follows T3 Code releases.

## Credits and license

Gusty Code is built on [T3 Code](https://github.com/pingdotgg/t3code) by T3 Tools Inc. It is not affiliated with or endorsed by T3 Tools Inc.

[MIT](./LICENSE), the same license as T3 Code.
