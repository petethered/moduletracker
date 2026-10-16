/**
 * decodePlayerInfoFile — the FILE layer of Import Player Info: playerInfo.dat's
 * raw bytes -> the NRBF save bytes that readPlayerInfoSave (parsePlayerInfo.ts)
 * decodes. Knows nothing about modules or pulls.
 *
 * Steps:
 *   1. Game 29.1+ wraps the file in an encrypted TDS1 container: decrypt it
 *      locally (tds1SaveContainer.ts, Web Crypto). Older saves skip this.
 *   2. Gunzip (the game always gzips the payload), size-capped.
 *
 * Also owns PlayerInfoFormatError and the player-facing messages, shared with
 * parsePlayerInfo.ts (imports point this way only: parse -> decode -> tds1).
 */
import { Tds1Error, decryptTds1Save, type Tds1FailureReason } from "./tds1SaveContainer";

/**
 * A problem the USER should see. Messages are plain language. Any other error
 * reaching the UI is unexpected and gets a generic message instead of internals.
 */
export class PlayerInfoFormatError extends Error {
  /** `cause` keeps the technical error for logs/debugging. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlayerInfoFormatError";
  }
}

export const NOT_A_SAVE = "This file doesn't look like a The Tower save (playerInfo.dat).";
export const UNREADABLE_SAVE =
  "Couldn't read this save file. It may be damaged, or from a game version the tracker doesn't support yet.";

/**
 * Real saves are ~200 KB decompressed. The cap only exists so a malicious or
 * corrupt gzip ("zip bomb") can't inflate until the tab runs out of memory.
 */
const MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

/** Player-facing text per TDS1 failure (see tds1SaveContainer.ts). */
const TDS1_FAILURE_MESSAGES: Record<Tds1FailureReason, string> = {
  truncated: UNREADABLE_SAVE,
  "unsupported-version": UNREADABLE_SAVE,
  // Effectively unreachable: the HMAC is checked first, so a file that gets
  // this far has genuine ciphertext and valid padding. Kept for completeness.
  decrypt: UNREADABLE_SAVE,
  // Most likely a game update changed the save encryption keys.
  integrity:
    "Couldn't unlock this save. It may be damaged, or from a newer game version the tracker doesn't support yet.",
  "no-web-crypto": "This browser can't open encrypted saves on this page. Open the tracker over https and try again.",
};

/**
 * Turn playerInfo.dat's bytes into the raw NRBF save:
 *   1. Game 29.1+ wraps the file in an encrypted TDS1 container: decrypt it
 *      (decryptTds1Save; locally, via Web Crypto).
 *   2. Gunzip (the game always gzips the payload). Bytes that don't start with
 *      the gzip magic number are returned as-is, so an already extracted save
 *      also works.
 * @throws PlayerInfoFormatError for a TDS1 file that can't be opened, corrupt
 *   gzip, or output over `maxBytes`.
 */
export async function decodePlayerInfoFile(
  input: Uint8Array,
  maxBytes = MAX_DECOMPRESSED_BYTES,
): Promise<Uint8Array> {
  let bytes = input;
  try {
    bytes = await decryptTds1Save(input);
  } catch (err) {
    if (err instanceof Tds1Error) throw new PlayerInfoFormatError(TDS1_FAILURE_MESSAGES[err.reason], { cause: err });
    throw err;
  }
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;

  // Platform DecompressionStream (all current browsers, Node 18+) keeps a gzip
  // library out of the bundle. A hand-built ReadableStream rather than
  // Blob.stream(): identical in browsers, and jsdom (unit tests) lacks the latter.
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes as Uint8Array<ArrayBuffer>);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("gzip")).getReader();

  // Read chunk by chunk so the size cap is enforced BEFORE memory is spent.
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PlayerInfoFormatError("This file is too large to be a The Tower save.");
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof PlayerInfoFormatError) throw err;
    throw new PlayerInfoFormatError(UNREADABLE_SAVE);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
