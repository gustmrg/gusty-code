// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - Standalone Sharp asset generator.
/** Rasterizes the Gusty Code vectors in assets/gusty into every app icon slot. `--check` verifies. */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import sharp from "sharp";

import { BRAND_ASSET_PATHS, resolveWebIconOverrides } from "./lib/brand-assets.ts";
import { encodePngIco, WINDOWS_ICON_SIZES } from "./lib/icon-export.ts";

const TILE_COLOR = "#0B1020";

const root = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const readSource = (name: string) =>
  NodeFSP.readFile(NodePath.join(root, "assets/gusty", name), "utf8");
const mark = await readSource("gusty-mark.svg");
const mono = await readSource("gusty-mark-light.svg");

const inner = (svg: string) => svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const tile = (mac: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="${mac ? 48 : 0}" y="${mac ? 48 : 0}" width="${mac ? 416 : 512}" height="${mac ? 416 : 512}" rx="${mac ? 96 : 0}" fill="${TILE_COLOR}"/><g transform="translate(${mac ? 96 : 64} ${mac ? 96 : 64}) scale(${mac ? 0.625 : 0.75})">${inner(mark)}</g></svg>`;
// Android adaptive icons crop to a central circle, so the mark keeps to the safe zone.
const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(100 100) scale(.609375)">${inner(mark)}</g></svg>`;
const white = (svg: string) =>
  svg.replace(/fill="url\(#[^)]+\)"/g, 'fill="#ffffff"').replaceAll("#E5E7EB", "#ffffff");

// Supersample, then downscale, so small sizes keep crisp edges.
const png = async (svg: string, size: number) => {
  const raster = await sharp(Buffer.from(svg), { density: Math.max(72, (size / 512) * 288) })
    .resize(size * 4, size * 4)
    .png()
    .toBuffer();
  return sharp(raster).resize(size, size, { kernel: "lanczos3" }).png().toBuffer();
};
const ico = (svg: string, sizes: ReadonlyArray<number>) =>
  Promise.all(sizes.map(async (size) => ({ size, contents: await png(svg, size) }))).then(
    encodePngIco,
  );

const slots = {
  IosIconPng: () => png(tile(false), 1024),
  MacIconPng: () => png(tile(true), 1024),
  DesktopIconPng: () => png(tile(true), 1024),
  LinuxIconPng: () => png(mark, 1024),
  UniversalIconPng: () => png(mark, 1024),
  WindowsIconIco: () => ico(mark, WINDOWS_ICON_SIZES),
  WebFaviconIco: () => ico(mark, [16, 32, 48]),
  WebFavicon16Png: () => png(mark, 16),
  WebFavicon32Png: () => png(mark, 32),
  WebAppleTouchIconPng: () => png(tile(false), 180),
  WebIcon192Png: () => png(tile(false), 192),
  WebIcon512Png: () => png(tile(false), 512),
} as const;

const outputs = new Map<string, Buffer>();
for (const [key, target] of Object.entries(BRAND_ASSET_PATHS)) {
  if (key.endsWith("IconComposerProject")) continue;
  const slot = Object.entries(slots).find(([suffix]) => key.endsWith(suffix));
  if (!slot) throw new Error(`No Gusty export for ${key}`);
  outputs.set(target, await slot[1]());
}
for (const entry of resolveWebIconOverrides("production", "apps/web/public")) {
  const content = outputs.get(entry.sourceRelativePath);
  if (!content) throw new Error(`Missing source: ${entry.sourceRelativePath}`);
  outputs.set(entry.targetRelativePath, content);
}
outputs.set("apps/mobile/assets/android-icon-foreground.png", await png(adaptive, 432));
outputs.set("apps/mobile/assets/android-icon-mark.png", await png(white(adaptive), 432));
outputs.set("apps/mobile/assets/android-notification-icon.png", await png(white(mono), 96));
for (const stage of ["prod", "nightly", "dev"]) {
  outputs.set(`apps/mobile/assets/android-splash-icon-${stage}.png`, await png(mark, 1152));
}

const stale: string[] = [];
for (const [relative, data] of outputs) {
  const target = NodePath.join(root, relative);
  if (check) {
    const existing = await NodeFSP.readFile(target).catch(() => null);
    if (!existing?.equals(data)) stale.push(relative);
  } else {
    await NodeFSP.writeFile(target, data);
  }
}
if (stale.length) throw new Error(`Outdated Gusty assets:\n${stale.join("\n")}`);
console.log(`${check ? "Verified" : "Exported"} ${outputs.size} Gusty Code assets.`);
