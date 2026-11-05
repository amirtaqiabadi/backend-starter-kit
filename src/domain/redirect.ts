/** Why: a post-login path must stay on this origin, so anything else falls back to home. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0) {
    return fallback;
  }
  if (!isRelativePath(next)) {
    return fallback;
  }
  try {
    if (!isRelativePath(decodeURIComponent(next))) {
      return fallback;
    }
  } catch {
    return fallback;
  }
  return next;
}

/** Why: open redirects hide behind a second slash, a scheme, or a backslash. */
function isRelativePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return false;
  }
  if (path.includes("\\") || path.includes("://")) {
    return false;
  }
  return true;
}
