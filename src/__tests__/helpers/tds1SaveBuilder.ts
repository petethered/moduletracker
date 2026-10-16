/**
 * tds1SaveBuilder — TEST-ONLY: wrap a gzip payload in The Tower 29.1+'s
 * encrypted TDS1 container, the exact inverse of decryptTds1Save.
 *
 * USED BY: src/__tests__/tds1SaveContainer.test.ts AND
 * e2e/player-info-import.spec.ts. No vitest / node:* imports (Playwright loads
 * it too); uses globalThis.crypto.subtle (Node 20+, browsers).
 *
 * A real encrypted save is personal player data and is never committed; the
 * port itself is pinned against TheTowerSDK's reference vectors in the unit test.
 */
import {
  TDS1_LAYOUT as L,
  deriveTds1Keys,
  maskTds1Payload,
  tds1AuthenticatedData,
} from "../../features/settings/tds1SaveContainer";

export interface Tds1BuildOptions {
  /** Container version byte (default 1, the only real one). */
  version?: number;
  /** Fixed IV for deterministic output (default: random). */
  iv?: Uint8Array;
}

export async function buildTds1Save(gzipPayload: Uint8Array, opts: Tds1BuildOptions = {}): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const keys = deriveTds1Keys();
  const iv = opts.iv ?? globalThis.crypto.getRandomValues(new Uint8Array(L.MAC_START - L.IV_START));
  const masked = maskTds1Payload(Uint8Array.from(gzipPayload)) as Uint8Array<ArrayBuffer>;

  const aesKey = await subtle.importKey("raw", keys.encryption as Uint8Array<ArrayBuffer>, "AES-CBC", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: "AES-CBC", iv: iv as Uint8Array<ArrayBuffer> }, aesKey, masked));

  const version = opts.version ?? L.VERSION;
  const authenticated = tds1AuthenticatedData(version, iv, ciphertext);
  const macKey = await subtle.importKey("raw", keys.authentication as Uint8Array<ArrayBuffer>, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await subtle.sign("HMAC", macKey, authenticated));

  const out = new Uint8Array(L.HEADER_SIZE + ciphertext.length);
  out.set(L.MAGIC, 0);
  out[L.VERSION_OFFSET] = version;
  out.set(iv, L.IV_START);
  out.set(mac, L.MAC_START);
  out.set(ciphertext, L.HEADER_SIZE);
  return out;
}
