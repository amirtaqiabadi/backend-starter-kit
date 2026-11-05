import { hash, verify } from "@node-rs/argon2";

const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_PASSWORD = "dummy-password-not-a-login";
let dummyHashPromise: Promise<string> | undefined;

/** Why: stored passwords must use Argon2id with the OWASP memory and iteration costs. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

/** Why: missing users and users without a password must still pay the hash cost. */
export async function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  if (passwordHash === null) {
    await verify(await dummyHash(), password);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Why: the dummy hash is computed once so unknown-user logins do not also pay for hashing. */
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hash(DUMMY_PASSWORD, ARGON_OPTIONS);
  return dummyHashPromise;
}
