import { describe, expect, it } from "vite-plus/test";

import {
  CLI_RELEASES_PAGE_URL,
  cliArchiveTarCommand,
  cliReleaseAssetUrl,
  cliReleaseDownloadBaseUrl,
  cliReleaseIndexPageUrl,
  newestCliReleaseVersion,
  parseChecksums,
} from "./cliRelease.ts";

describe("cliRelease", () => {
  it("parses sha256sum output including binary-mode markers", () => {
    const checksums = parseChecksums(
      [
        `${"a".repeat(64)}  t3-1.2.3-linux-x64.tar.gz`,
        `${"B".repeat(64)} *t3-1.2.3-win32-x64.zip`,
        "not a checksum line",
        "",
      ].join("\n"),
    );
    expect(checksums.get("t3-1.2.3-linux-x64.tar.gz")).toBe("a".repeat(64));
    expect(checksums.get("t3-1.2.3-win32-x64.zip")).toBe("b".repeat(64));
    expect(checksums.size).toBe(2);
  });

  it("extracts with the System32 bsdtar on Windows and plain tar elsewhere", () => {
    expect(cliArchiveTarCommand("linux", {})).toBe("tar");
    expect(cliArchiveTarCommand("win32", { SystemRoot: "D:\\Win" })).toBe(
      "D:\\Win\\System32\\tar.exe",
    );
    expect(cliArchiveTarCommand("win32", {})).toBe("C:\\Windows\\System32\\tar.exe");
  });

  it("picks the newest non-draft release on the requested channel from gusty-v tags", () => {
    const releases = [
      { tag_name: "gusty-v1.2.4-preview.20260912.9", draft: true },
      { tag_name: "gusty-v1.2.4-preview.20260912.8" },
      { tag_name: "gusty-v1.2.4-nightly.20260912.7" },
      { tag_name: "desktop-preview" },
      { tag_name: "v9.9.9" },
      { tag_name: "gusty-v1.2.3" },
      { tag_name: "gusty-v1.2.3-nightly.20260911.2" },
    ];
    expect(newestCliReleaseVersion(releases, "preview")).toBe("1.2.4-preview.20260912.8");
    expect(newestCliReleaseVersion(releases, "nightly")).toBe("1.2.4-nightly.20260912.7");
    expect(newestCliReleaseVersion(releases, "stable")).toBe("1.2.3");
    expect(newestCliReleaseVersion([{ tag_name: "gusty-v1.2.3" }], "preview")).toBeUndefined();
  });

  it("points release URLs to the gustmrg/gusty-code fork with gusty-v tags", () => {
    expect(CLI_RELEASES_PAGE_URL).toBe("https://github.com/gustmrg/gusty-code/releases");
    expect(cliReleaseIndexPageUrl(1)).toBe(
      "https://api.github.com/repos/gustmrg/gusty-code/releases?per_page=100&page=1",
    );
    expect(cliReleaseDownloadBaseUrl("0.1.12")).toBe(
      "https://github.com/gustmrg/gusty-code/releases/download/gusty-v0.1.12",
    );
    expect(cliReleaseAssetUrl("0.1.12", "SHA256SUMS")).toBe(
      "https://github.com/gustmrg/gusty-code/releases/download/gusty-v0.1.12/SHA256SUMS",
    );
  });
});
