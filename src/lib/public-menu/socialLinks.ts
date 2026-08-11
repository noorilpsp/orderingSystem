/** Normalize a social handle or pasteable URL into a public profile href. */

function stripAt(value: string): string {
  return value.trim().replace(/^@+/, "");
}

export function instagramProfileUrl(handleOrUrl: string | null | undefined): string | null {
  const raw = handleOrUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = stripAt(raw.replace(/^instagram\.com\//i, "").replace(/^www\./i, ""));
  if (!handle) return null;
  return `https://www.instagram.com/${handle}`;
}

export function tiktokProfileUrl(handleOrUrl: string | null | undefined): string | null {
  const raw = handleOrUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = stripAt(
    raw.replace(/^tiktok\.com\//i, "").replace(/^www\./i, "").replace(/^@/, ""),
  );
  if (!handle) return null;
  return `https://www.tiktok.com/@${handle}`;
}

export function facebookProfileUrl(handleOrUrl: string | null | undefined): string | null {
  const raw = handleOrUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = stripAt(
    raw
      .replace(/^facebook\.com\//i, "")
      .replace(/^fb\.com\//i, "")
      .replace(/^www\./i, ""),
  );
  if (!handle) return null;
  return `https://www.facebook.com/${handle}`;
}
