/**
 * nrbfByteReader.ts — bounds-checked little-endian cursor + primitive decoding
 * for nrbfReader.ts (the MS-NRBF / .NET BinaryFormatter decoder). Split out
 * only to keep each file focused and under the size limit; not used elsewhere.
 *
 * HARDENING (every read goes through need()):
 *   Input is an untrusted file. A malformed length must never move the cursor
 *   backwards (infinite re-read loop) or skip the end-of-buffer check.
 *   need() rejects negative and past-the-end sizes; lps() rejects varints that
 *   overflow int32.
 */

import { BinaryType, type MemberType } from "./nrbfTypes";

/** Thrown for any structural problem in the stream. Messages are technical (for logs). */
export class NrbfFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NrbfFormatError";
  }
}

const utf8Decoder = new TextDecoder();

export class ByteReader {
  pos = 0;
  private readonly bytes: Uint8Array;
  private readonly view: DataView;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining() {
    return this.bytes.length - this.pos;
  }

  private need(n: number) {
    if (!Number.isInteger(n) || n < 0) {
      throw new NrbfFormatError(`Invalid length ${n} at byte ${this.pos}`);
    }
    if (n > this.remaining) {
      throw new NrbfFormatError(`Stream is truncated (unexpected end at byte ${this.pos})`);
    }
  }

  u8() { this.need(1); return this.bytes[this.pos++]; }
  peek() { return this.pos < this.bytes.length ? this.bytes[this.pos] : -1; }
  i16() { this.need(2); const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  u16() { this.need(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { this.need(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i64() { this.need(8); const v = this.view.getBigInt64(this.pos, true); this.pos += 8; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.pos, true); this.pos += 8; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
  raw(n: number) { this.need(n); const v = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return v; }

  /**
   * LengthPrefixedString: 7-bit varint byte count (max 5 bytes, int32), then
   * UTF-8. The 5th varint byte may only carry the top 3 bits of an int32 —
   * anything larger would overflow to a negative length.
   */
  lps() {
    let length = 0;
    for (let i = 0; ; i++) {
      const b = this.u8();
      if (i === 4 && b > 0x07) throw new NrbfFormatError(`String length overflows at byte ${this.pos - 1}`);
      length |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) break;
      if (i === 4) throw new NrbfFormatError(`String length is too long at byte ${this.pos - 1}`);
    }
    return utf8Decoder.decode(this.raw(length));
  }
}

/** MS-NRBF PrimitiveTypeEnum codes that are legal as array ELEMENTS (not Null 17 / String 18). */
export function isArrayPrimitive(type: number) {
  return type >= 1 && type <= 16 && type !== 4;
}

/**
 * Decode one primitive of MS-NRBF PrimitiveTypeEnum `type`.
 * Int64/UInt64/TimeSpan/DateTime -> bigint (DateTime: .NET ticks, Kind bits masked).
 * Decimal (serialized as text) and Char -> string.
 */
export function readPrimitive(r: ByteReader, type: number): boolean | number | bigint | string | null {
  switch (type) {
    case 1: return r.u8() !== 0;                    // Boolean
    case 2: return r.u8();                          // Byte
    case 3: {                                       // Char: one UTF-8 code point
      const first = r.peek();
      const size = first < 0x80 ? 1 : first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4;
      return utf8Decoder.decode(r.raw(size));
    }
    case 5: return r.lps();                         // Decimal
    case 6: return r.f64();                         // Double
    case 7: return r.i16();                         // Int16
    case 8: return r.i32();                         // Int32
    case 9: return r.i64();                         // Int64
    case 10: { const v = r.u8(); return v > 127 ? v - 256 : v; } // SByte
    case 11: return r.f32();                        // Single
    case 12: return r.i64();                        // TimeSpan (ticks)
    case 13: return r.u64() & 0x3fffffffffffffffn;  // DateTime ticks; top 2 bits = DateTimeKind
    case 14: return r.u16();                        // UInt16
    case 15: return r.u32();                        // UInt32
    case 16: return r.u64();                        // UInt64
    case 17: return null;                           // Null
    case 18: return r.lps();                        // String
    default: throw new NrbfFormatError(`Primitive type ${type} is not supported`);
  }
}

/**
 * Read a MemberTypeInfo block: `count` BinaryTypeEnum bytes, then each type's
 * additional info (primitive code, or class name [+ library id]). Class names
 * are consumed but not kept — the decoder only needs to know how to read values.
 */
export function readMemberTypes(r: ByteReader, count: number): MemberType[] {
  const kinds: number[] = [];
  for (let i = 0; i < count; i++) kinds.push(r.u8());
  return kinds.map((binaryType) => {
    switch (binaryType) {
      case BinaryType.Primitive:
      case BinaryType.PrimitiveArray:
        return { binaryType, primitive: r.u8() };
      case BinaryType.SystemClass:
        r.lps();
        return { binaryType };
      case BinaryType.Class:
        r.lps();
        r.i32();
        return { binaryType };
      default:
        return { binaryType };
    }
  });
}
