export type AuthFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  attemptsRemaining?: number;
  retryAfter?: number;
};

export type AuthSuccess<T> = { ok: true; data: T };

export type AuthResult<T> = AuthSuccess<T> | AuthFailure;

/** Why: every rejected auth step should carry the same status, code, and Persian copy. */
export function fail(input: {
  status: number;
  code: string;
  message: string;
  attemptsRemaining?: number;
  retryAfter?: number;
}): AuthFailure {
  return { ok: false, ...input };
}
