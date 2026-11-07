const CROCKFORD32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_LENGTH = 64;
const KEY_BYTE_COUNT = 40;

/** Why: merchant_correlation_key is 64 Crockford characters from a CSPRNG, not a guessable sequence. */
export function correlationKeyFromBytes(bytes: Uint8Array): string {
  if (bytes.length < KEY_BYTE_COUNT) {
    throw new Error("correlation key entropy is too short");
  }
  let bits = 0;
  let buffer = 0;
  let key = "";
  for (let index = 0; index < KEY_BYTE_COUNT; index += 1) {
    buffer = (buffer << 8) | bytes[index];
    bits += 8;
    while (bits >= 5 && key.length < KEY_LENGTH) {
      key += CROCKFORD32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return key;
}

export { KEY_BYTE_COUNT as CORRELATION_KEY_BYTE_COUNT };
