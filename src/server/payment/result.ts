export type PaymentErrorType = "VALIDATION_ERROR" | "DOMAIN_ERROR" | "SYSTEM_ERROR";

export type PaymentFailure = {
  ok: false;
  status: number;
  type: PaymentErrorType;
  code: string;
  message: string;
  retryAfter?: number;
};

export type PaymentSuccess<T> = { ok: true; data: T };

export type PaymentResult<T> = PaymentSuccess<T> | PaymentFailure;

/** Why: payment errors keep a stable code and a Persian message without a stack. */
export function paymentFail(input: {
  status: number;
  type: PaymentErrorType;
  code: string;
  message: string;
  retryAfter?: number;
}): PaymentFailure {
  return { ok: false, ...input };
}
