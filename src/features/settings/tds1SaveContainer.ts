/**
 * tds1SaveContainer — unwraps the encrypted "TDS1" container The Tower wraps
 * playerInfo.dat in since game 29.1 (seen on 29.1.1, build 1250, 2026-10-16).
 * Before 29.1 the file was plain gzip; inside the container it still is, so
 * decodePlayerInfoFile (decodePlayerInfoFile.ts) calls decryptTds1Save first and
 * then gunzips as before.
 *
 * SOURCE / LICENSE: ported from TheTowerSDK `src/save-decoder/encrypted.ts`
 * (npm `thetowersdk@0.12.0`, dist/save-decoder/encrypted.js), MIT License,
 * Copyright (c) 2026 TmRxJD — https://github.com/TmRxJD/TheTowerSDK
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *   and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions: The
 *   above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED
 *   "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 * Vendored (not an npm dependency) because the package's exports map only
 * exposes `thetowersdk/save-decoder`, which also bundles its own NRBF reader +
 * zod; this tracker already has a reader and only needs this ~100-line step.
 *
 * WHEN A GAME UPDATE BREAKS IT (HMAC check fails on a fresh save): the game
 * changed the keys/mask. Check TheTowerSDK for a newer encrypted.ts, re-port
 * it here, and update the version above. Old-format (gzip) saves are untouched.
 *
 * LAYOUT (all offsets in bytes):
 *   0-3   "TDS1" magic          4      version (only 1 exists)
 *   5-20  AES-CBC IV (16)       21-52  HMAC-SHA256 tag (32)
 *   53-   AES-256-CBC ciphertext, PKCS#7 padded (so length % 16 === 0)
 *   HMAC covers bytes 4-20 (version + IV) followed by the ciphertext.
 *   Plaintext = the gzip payload XOR-masked/rotated by a keyed byte stream
 *   (unmaskSave). Both 256-bit keys are derived deterministically below.
 *
 * Runs entirely in the browser via Web Crypto: the save never leaves the
 * device. Web Crypto needs a secure context (https or localhost) — fine for
 * the deployed site and the dev server.
 */

/**
 * Container layout (see LAYOUT above). Exported so the test-only builder
 * (src/__tests__/helpers/tds1SaveBuilder.ts) writes files from the SAME
 * numbers it is checked against — a re-port that changes them can't leave the
 * two silently agreeing on an old layout.
 */
export const TDS1_LAYOUT = {
  MAGIC: [0x54, 0x44, 0x53, 0x31], // "TDS1"
  VERSION: 1,
  VERSION_OFFSET: 4,
  IV_START: 5,
  MAC_START: 21,
  HEADER_SIZE: 53,
  AES_BLOCK: 16,
} as const;
const { MAGIC, VERSION, VERSION_OFFSET, IV_START, MAC_START, HEADER_SIZE, AES_BLOCK } = TDS1_LAYOUT;

const PRIMARY_KEY_MULTIPLIER = 2654435761;
const SECONDARY_KEY_SEED = 668265263;
const MASK_HASH_SEED = 2166136261;
const MASK_HASH_MULTIPLIER = 16777619;
const MASK_MULTIPLIER = 1664525;
const MASK_INCREMENT = 1013904223;
const MASK_KEY = Uint8Array.from([
  0x35, 0x57, 0x9b, 0x22, 0x8d, 0xb6, 0x1a, 0x72,
  0xec, 0x95, 0xc0, 0x97, 0x80, 0x20, 0x2a, 0x9b,
  0xfa, 0xcb, 0x0c, 0x74, 0x0c, 0x05, 0x2b, 0xd4,
  0xe8, 0x3b, 0xe8, 0x82, 0xf3, 0xd8, 0xec, 0x5d,
]);

/**
 * Why a TDS1 save couldn't be opened. `reason` lets the caller pick a message
 * for players (parsePlayerInfo maps these to PlayerInfoFormatError text).
 */
export type Tds1FailureReason = "truncated" | "unsupported-version" | "no-web-crypto" | "integrity" | "decrypt";

export class Tds1Error extends Error {
  // Plain field, not a constructor parameter property: the repo's
  // `erasableSyntaxOnly` tsconfig flag forbids those.
  readonly reason: Tds1FailureReason;
  constructor(reason: Tds1FailureReason, message: string) {
    super(message);
    this.name = "Tds1Error";
    this.reason = reason;
  }
}

export function isTds1Save(bytes: Uint8Array): boolean {
  return bytes.length >= MAGIC.length && MAGIC.every((v, i) => bytes[i] === v);
}

/** The two deterministic 256-bit keys: AES encryption and HMAC authentication. */
export function deriveTds1Keys(): { encryption: Uint8Array; authentication: Uint8Array } {
  const encryption = new Uint8Array(32);
  const authentication = new Uint8Array(32);
  let primary = PRIMARY_KEY_MULTIPLIER;
  let secondary = SECONDARY_KEY_SEED;
  for (let i = 0; i < 32; i++) {
    primary = Math.imul(primary ^ (7 + i * 131), PRIMARY_KEY_MULTIPLIER) >>> 0;
    primary = (primary ^ (primary >>> 15)) >>> 0;
    encryption[i] = i * 29 + primary; // Uint8Array assignment keeps the low byte
    secondary = Math.imul(((secondary >>> 25) | (secondary << 7)) ^ (11 + i * 97), 0x9e37) >>> 0;
    authentication[i] = (i * 53) ^ (secondary >>> 11);
  }
  return { encryption, authentication };
}

/**
 * The keyed byte stream shared by mask and unmask: per byte i, a mask byte, a
 * rotation (0-7) and an additive offset. One generator so the two directions
 * can't drift apart.
 */
function* maskStream(length: number): Generator<{ mask: number; shift: number; offset: number }> {
  let state = MASK_HASH_SEED;
  for (const value of MASK_KEY) state = Math.imul(state ^ value, MASK_HASH_MULTIPLIER) >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, MASK_MULTIPLIER) + MASK_KEY[i & 31] + MASK_INCREMENT) >>> 0;
    yield {
      mask: (MASK_KEY[(i * 5 + 3) & 31] ^ (state >>> 24) ^ (state >>> 9)) & 255,
      shift: (state >>> 6) & 7,
      offset: (state >>> 13) & 255,
    };
  }
}

/** Reverse the game's byte mask (in place). */
export function unmaskTds1Payload(bytes: Uint8Array): Uint8Array {
  let i = 0;
  for (const { mask, shift, offset } of maskStream(bytes.length)) {
    const rotated = ((bytes[i] >>> shift) | (bytes[i] << (8 - shift))) & 255;
    bytes[i] = ((rotated - offset) & 255) ^ mask;
    i++;
  }
  return bytes;
}

/**
 * Apply the game's byte mask (in place) — the inverse of unmaskTds1Payload.
 * Only used to build synthetic TDS1 saves for tests (a real save is personal
 * data and is never committed); kept here so it can't drift from unmask.
 */
export function maskTds1Payload(bytes: Uint8Array): Uint8Array {
  let i = 0;
  for (const { mask, shift, offset } of maskStream(bytes.length)) {
    const added = ((bytes[i] ^ mask) + offset) & 255;
    bytes[i] = ((added << shift) | (added >>> (8 - shift))) & 255;
    i++;
  }
  return bytes;
}

/**
 * The bytes the HMAC covers: version byte, then IV, then ciphertext. One
 * function for the decryptor and the test builder so both sign the same thing.
 */
export function tds1AuthenticatedData(version: number, iv: Uint8Array, ciphertext: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(1 + iv.length + ciphertext.length);
  out[0] = version;
  out.set(iv, 1);
  out.set(ciphertext, 1 + iv.length);
  return out;
}

/**
 * Authenticate and decrypt a TDS1 save, returning the inner (gzip) payload.
 * Non-TDS1 input is returned unchanged, so callers can pass any file.
 * @throws Tds1Error
 */
export async function decryptTds1Save(input: Uint8Array): Promise<Uint8Array> {
  if (!isTds1Save(input)) return input;
  // Own the bytes across the async crypto calls so the caller can't alter
  // authenticated data mid-verify.
  const bytes = Uint8Array.from(input);
  if (bytes.length < HEADER_SIZE + AES_BLOCK || (bytes.length - HEADER_SIZE) % AES_BLOCK !== 0) {
    throw new Tds1Error("truncated", "TDS1 save is truncated or malformed.");
  }
  if (bytes[VERSION_OFFSET] !== VERSION) {
    throw new Tds1Error("unsupported-version", `Unsupported TDS1 version ${bytes[VERSION_OFFSET]}.`);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Tds1Error("no-web-crypto", "Web Crypto is unavailable (not a secure context?).");

  const iv = bytes.slice(IV_START, MAC_START);
  const mac = bytes.slice(MAC_START, HEADER_SIZE);
  const ciphertext = bytes.slice(HEADER_SIZE);
  const authenticated = tds1AuthenticatedData(bytes[VERSION_OFFSET], iv, ciphertext);

  const keys = deriveTds1Keys();
  const macKey = await subtle.importKey("raw", keys.authentication as Uint8Array<ArrayBuffer>, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  if (!(await subtle.verify("HMAC", macKey, mac, authenticated))) {
    // Corrupt/edited file, or a game update changed the keys (see header).
    throw new Tds1Error("integrity", "TDS1 save failed its HMAC integrity check.");
  }
  const aesKey = await subtle.importKey("raw", keys.encryption as Uint8Array<ArrayBuffer>, "AES-CBC", false, ["decrypt"]);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle.decrypt({ name: "AES-CBC", iv }, aesKey, ciphertext);
  } catch {
    throw new Tds1Error("decrypt", "TDS1 save could not be decrypted.");
  }
  return unmaskTds1Payload(new Uint8Array(plaintext));
}
