// Bundles every image in src/assets/images through Vite so that URLs are
// hashed, fingerprinted and always correct under any base path
// (localhost, custom domain, or GitHub Pages /<repo>/ subpath).
const bundled = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byFileName: Record<string, string> = {};
for (const [path, url] of Object.entries(bundled)) {
  byFileName[path.split('/').pop() as string] = url;
}

export function localAsset(fileName: string): string {
  return byFileName[fileName] ?? '';
}

/** Turns legacy "./src/assets/images/x.jpg" style paths into bundled URLs. */
export function resolveAssetUrl(src?: string): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:^|\/)assets\/images\/([^/?#]+)$/);
  if (m && byFileName[m[1]]) return byFileName[m[1]];
  return trimmed;
}
