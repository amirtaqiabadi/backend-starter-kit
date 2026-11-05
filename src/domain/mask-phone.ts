/** Why: logs and audit rows must not keep a full phone number. */
export function maskPhone(phone: string): string {
  if (phone.length < 8) {
    return "***";
  }
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
