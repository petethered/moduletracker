/**
 * nrbfWriter — TEST-ONLY encoder for the .NET BinaryFormatter wire format
 * (MS-NRBF), the format The Tower uses for playerInfo.dat (gzipped).
 *
 * USED BY: unit tests AND e2e/player-info-import.spec.ts (Playwright's Node
 * runtime). Keep it free of vitest and node:* imports so both can load it.
 *
 * WHY THIS EXISTS:
 *   We can't commit a real save file (it's personal player data), so unit and
 *   E2E tests build small synthetic saves with this writer instead. It
 *   emits a subset of the record types src/utils/nrbfReader.ts reads, and it mirrors
 *   the shapes observed in real saves: a class record per object, generic
 *   List<T> as {_items, _size, _version}, enums as a class with `value__`.
 *
 * NOT a general-purpose serializer: there is no object graph tracking. Each
 * call site writes records in stream order and manages its own object ids.
 */

// MS-NRBF RecordTypeEnum values used below.
const REC = {
  header: 0,
  classWithId: 1,
  classWithMembersAndTypes: 5,
  objectString: 6,
  binaryArray: 7,
  memberReference: 9,
  objectNull: 10,
  messageEnd: 11,
  library: 12,
  objectNullMultiple256: 13,
  arraySinglePrimitive: 15,
  arraySingleObject: 16,
} as const;

// MS-NRBF BinaryTypeEnum values (member / element type kinds).
const BinaryType = { primitive: 0, string: 1, object: 2, systemClass: 3, class: 4 } as const;
// MS-NRBF PrimitiveTypeEnum values the writer can encode.
export const PrimitiveType = { boolean: 1, byte: 2, double: 6, int32: 8, int64: 9, dateTime: 13 } as const;

/** A member's declared type in a ClassWithMembersAndTypes record. */
export type MemberType =
  | { kind: "primitive"; primitive: number }
  | { kind: "string" }
  | { kind: "object" }
  | { kind: "systemClass"; className: string }
  | { kind: "class"; className: string; libraryId: number };

export class NrbfWriter {
  private bytes: number[] = [];

  private u8(v: number) {
    this.bytes.push(v & 0xff);
  }
  private i32(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v, true);
    this.bytes.push(...b);
  }
  private f64(v: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    this.bytes.push(...b);
  }
  private i64(v: bigint) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, v, true);
    this.bytes.push(...b);
  }
  /** LengthPrefixedString: 7-bit varint byte length + UTF-8. */
  lps(s: string) {
    const utf8 = new TextEncoder().encode(s);
    let n = utf8.length;
    do {
      let byte = n & 0x7f;
      n >>>= 7;
      if (n) byte |= 0x80;
      this.u8(byte);
    } while (n);
    this.bytes.push(...utf8);
  }
  /** Raw primitive value (no record header) — how primitive MEMBERS are written. */
  primitive(type: number, value: number | boolean | bigint) {
    switch (type) {
      case PrimitiveType.boolean: return this.u8(value ? 1 : 0);
      case PrimitiveType.byte: return this.u8(Number(value));
      case PrimitiveType.int32: return this.i32(Number(value));
      case PrimitiveType.double: return this.f64(Number(value));
      case PrimitiveType.int64: return this.i64(BigInt(value));
      case PrimitiveType.dateTime: return this.i64(BigInt(value));
      default: throw new Error(`nrbfWriter: primitive ${type} not supported`);
    }
  }

  header(rootId: number) {
    this.u8(REC.header); this.i32(rootId); this.i32(-1); this.i32(1); this.i32(0);
    return this;
  }
  library(id: number, name: string) {
    this.u8(REC.library); this.i32(id); this.lps(name);
    return this;
  }
  /** Class definition + its values follow via the caller (write members in order). */
  classWithMembersAndTypes(objectId: number, className: string, members: [string, MemberType][], libraryId: number) {
    this.u8(REC.classWithMembersAndTypes);
    this.i32(objectId); this.lps(className); this.i32(members.length);
    for (const [name] of members) this.lps(name);
    const kindCode = { primitive: BinaryType.primitive, string: BinaryType.string, object: BinaryType.object, systemClass: BinaryType.systemClass, class: BinaryType.class };
    for (const [, t] of members) this.u8(kindCode[t.kind]);
    for (const [, t] of members) {
      if (t.kind === "primitive") this.u8(t.primitive);
      else if (t.kind === "systemClass") this.lps(t.className);
      else if (t.kind === "class") { this.lps(t.className); this.i32(t.libraryId); }
    }
    this.i32(libraryId);
    return this;
  }
  /** Reuse an earlier class definition (metadataId = that record's objectId). */
  classWithId(objectId: number, metadataId: number) {
    this.u8(REC.classWithId); this.i32(objectId); this.i32(metadataId);
    return this;
  }
  string(objectId: number, value: string) {
    this.u8(REC.objectString); this.i32(objectId); this.lps(value);
    return this;
  }
  reference(idRef: number) {
    this.u8(REC.memberReference); this.i32(idRef);
    return this;
  }
  nullRecord() {
    this.u8(REC.objectNull);
    return this;
  }
  nullMultiple(count: number) {
    this.u8(REC.objectNullMultiple256); this.u8(count);
    return this;
  }
  arraySinglePrimitive(objectId: number, type: number, values: (number | boolean)[]) {
    this.u8(REC.arraySinglePrimitive); this.i32(objectId); this.i32(values.length); this.u8(type);
    for (const v of values) this.primitive(type, v);
    return this;
  }
  /** Standalone typed primitive value record (MemberPrimitiveTyped) — e.g. an element of object[]. */
  primitiveRecord(type: number, value: number | boolean | bigint) {
    this.u8(8); this.u8(type); this.primitive(type, value);
    return this;
  }
  /** Escape hatch for hand-crafting malformed input in hardening tests. */
  rawBytes(...bytes: number[]) {
    this.bytes.push(...bytes.map((b) => b & 0xff));
    return this;
  }
  /** Little-endian int32 without a record header (for malformed-input tests). */
  rawInt32(v: number) {
    this.i32(v);
    return this;
  }
  /** Current bytes without a MessageEnd (for truncation tests). */
  bytesSoFar() {
    return new Uint8Array(this.bytes);
  }
  /** Header for an object[] whose `length` element records the caller writes next. */
  arraySingleObject(objectId: number, length: number) {
    this.u8(REC.arraySingleObject); this.i32(objectId); this.i32(length);
    return this;
  }
  /** Header for a single-rank typed class array (e.g. ModuleItem[]); caller writes elements. */
  classArray(objectId: number, length: number, className: string, libraryId: number) {
    this.u8(REC.binaryArray); this.i32(objectId);
    this.u8(0); // BinaryArrayTypeEnum.Single
    this.i32(1); this.i32(length);
    this.u8(BinaryType.class); this.lps(className); this.i32(libraryId);
    return this;
  }
  end() {
    this.u8(REC.messageEnd);
    return new Uint8Array(this.bytes);
  }
}
