import { maskPhone } from "@/domain/mask-phone";
import { getPrisma } from "@/server/db";

export type AuthEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "OTP_REQUEST"
  | "OTP_VERIFY_SUCCESS"
  | "OTP_VERIFY_FAILURE"
  | "PASSWORD_SET"
  | "PASSWORD_RESET";

/** Why: security events should be recorded without turning an audit outage into a failed login. */
export async function recordAuthEvent(input: {
  type: AuthEventType;
  phone: string;
  ip: string;
  userAgent: string;
  userId?: string | null;
}): Promise<void> {
  try {
    await getPrisma().authEvent.create({
      data: {
        type: input.type,
        phoneMasked: maskPhone(input.phone),
        ip: input.ip,
        userAgent: input.userAgent,
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    console.error("auth_event_failed", error);
  }
}
