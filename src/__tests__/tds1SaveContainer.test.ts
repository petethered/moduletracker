import { describe, it, expect, vi, afterEach } from "vitest";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  decryptTds1Save,
  isTds1Save,
  maskTds1Payload,
  deriveTds1Keys,
  unmaskTds1Payload,
} from "../features/settings/tds1SaveContainer";
import { PlayerInfoFormatError, decodePlayerInfoFile } from "../features/settings/decodePlayerInfoFile";
import { extractSaveModules, readPlayerInfoSave } from "../features/settings/parsePlayerInfo";
import { extractSavePulls } from "../features/settings/playerInfoPulls";
import { buildPlayerInfoSave, buildPullDrops, GameRarity as R } from "./helpers/playerInfoSaveBuilder";
import { buildTds1Save } from "./helpers/tds1SaveBuilder";

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

const synthetic = () =>
  gzipSync(
    buildPlayerInfoSave({
      inventory: [{ infoIndex: 7, rarity: R.fiveStar }], // Havoc Bringer
      pullDrops: buildPullDrops([{ common: 8, rare: 1, epics: [7] }], new Date(2026, 9, 12, 9).getTime()),
    }),
  );

describe("TDS1 port matches TheTowerSDK 0.12.0", () => {
  // Reference values computed from thetowersdk@0.12.0's own
  // saveEncryptionKeys() / unmaskSave(). If these fail, the port drifted.
  it("derives the same keys", () => {
    const { encryption, authentication } = deriveTds1Keys();
    expect(sha256(encryption)).toBe("7ba74d026696b19f866da27b34440d2e1a664f864f8a9a797fd13b3c352fcd7b");
    expect(sha256(authentication)).toBe("ff7dc340426d4e441dcac243939d3b1992b4a79848985e0decbe913c5f1e19e4");
  });

  it("unmasks the same way", () => {
    const sample = Uint8Array.from([0x1f, 0x8b, 8, 0, 1, 2, 3, 4, 250, 251, 252, 253, 0, 0, 0, 0]);
    expect(hex(unmaskTds1Payload(Uint8Array.from(sample)))).toBe("0d581e5ab828e3152d51d3be77a77e43");
  });

  it("mask is the exact inverse of unmask", () => {
    const data = Uint8Array.from({ length: 300 }, (_, i) => (i * 37 + 11) & 255);
    expect(hex(unmaskTds1Payload(maskTds1Payload(Uint8Array.from(data))))).toBe(hex(data));
  });
});

describe("decryptTds1Save / decodePlayerInfoFile", () => {
  it("passes non-TDS1 bytes through untouched", async () => {
    const gz = synthetic();
    expect(isTds1Save(gz)).toBe(false);
    expect(await decryptTds1Save(gz)).toBe(gz);
  });

  it("reads modules AND pulls from an encrypted save, same as the plain gzip one", async () => {
    const gz = synthetic();
    const plain = readPlayerInfoSave(await decodePlayerInfoFile(gz));
    const encrypted = readPlayerInfoSave(await decodePlayerInfoFile(await buildTds1Save(gz)));
    expect(extractSaveModules(encrypted)).toEqual(extractSaveModules(plain));
    expect(extractSavePulls(encrypted)).toEqual(extractSavePulls(plain));
    expect(extractSaveModules(encrypted).modules).toEqual({ "havoc-bringer": "5*" });
  });

  it("rejects a tampered file with a plain-language error (HMAC check)", async () => {
    const file = await buildTds1Save(synthetic());
    file[file.length - 1] ^= 1;
    await expect(decodePlayerInfoFile(file)).rejects.toThrow(PlayerInfoFormatError);
    await expect(decodePlayerInfoFile(file)).rejects.toThrow("Couldn't unlock this save");
  });

  it("rejects truncated files and unknown container versions as unreadable", async () => {
    const file = await buildTds1Save(synthetic());
    await expect(decodePlayerInfoFile(file.slice(0, 60))).rejects.toThrow("Couldn't read this save file");
    const v2 = await buildTds1Save(synthetic(), { version: 2 });
    await expect(decodePlayerInfoFile(v2)).rejects.toThrow("Couldn't read this save file");
  });

  describe("without Web Crypto (an http:// page)", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("tells the player to open the tracker over https", async () => {
      const file = await buildTds1Save(synthetic()); // built while crypto still exists
      vi.stubGlobal("crypto", {});
      await expect(decodePlayerInfoFile(file)).rejects.toThrow("Open the tracker over https");
    });
  });
});
