/** Why: sandbox authorities start with S and must never be verified against production. */
export function isSandboxAuthority(authority: string): boolean {
  return authority.startsWith("S");
}

/** Why: a missing or mixed-environment authority must fail the attempt instead of redirecting. */
export function isUsableAuthority(authority: string, sandbox: boolean): boolean {
  if (!authority) {
    return false;
  }
  if (sandbox) {
    return isSandboxAuthority(authority);
  }
  return !isSandboxAuthority(authority);
}
