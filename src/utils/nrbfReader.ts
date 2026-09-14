/**
 * nrbfReader.ts — read-only decoder for the .NET BinaryFormatter wire format
 * (MS-NRBF: https://learn.microsoft.com/openspecs/windows_protocols/ms-nrbf).
 *
 * ROLE:
 *   The Tower (a Unity game) saves player state as a gzipped BinaryFormatter
 *   stream (playerInfo.dat). This turns the DEcompressed bytes into a plain JS
 *   object graph. It is game-agnostic: the game-specific extraction lives in
 *   src/features/settings/parsePlayerInfo.ts. Primitive/byte decoding lives in
 *   nrbfByteReader.ts; format constants and the public types in nrbfTypes.ts.
 *
 * OUTPUT SHAPE:
 *   - class instance  -> NrbfObject { $class, members } (use isNrbfObject).
 *                        Enums arrive as a class whose only member is `value__`.
 *                        Generic List<T> is a class with `_items` (backing
 *                        array, often longer than the list) and `_size`.
 *   - string, Decimal, Char -> string
 *   - arrays          -> JS arrays. Multi-dimensional (rank > 1) arrays are
 *                        FLATTENED in row-major order — real saves contain
 *                        one, so these must decode, not throw. Exception: a
 *                        byte[] sent as an ArraySinglePrimitive record -> Uint8Array.
 *   - Int32/Double/etc -> number;  Int64/UInt64/TimeSpan/DateTime -> bigint
 *   - null            -> null
 *   MemberReferences are resolved after the whole stream is read, so forward
 *   references work and shared objects are the same JS object. The graph can
 *   contain cycles — never JSON.stringify it blindly. A reference to an id
 *   that never appears resolves to null (lenient on purpose: one dangling
 *   pointer shouldn't sink a whole save).
 *
 * NOT SUPPORTED (throws NrbfFormatError): remoting MethodCall/MethodReturn
 *   records (never present in saves).
 *
 * HARDENING — input is an untrusted file. The worst a malformed stream can do
 *   is throw NrbfFormatError; it must never hang or allocate without bound:
 *   - every byte read is bounds-checked (nrbfByteReader.ts)
 *   - declared array lengths (for multi-dimensional arrays, the product of
 *     all dimensions) must be non-negative and <= MAX_ARRAY_LENGTH
 *   - a null run can't exceed the space left in its array
 *   - primitive arrays can't use zero-byte element types (Null), which would
 *     otherwise let a huge declared length loop without consuming input
 *   Nesting depth is not capped: a pathologically deep file throws a
 *   RangeError (stack overflow), which callers treat like any other failure.
 *
 * SECURITY: unlike .NET's BinaryFormatter this never instantiates types —
 *   class names are just strings — so a hostile file can't execute anything.
 */
import { ByteReader, NrbfFormatError, isArrayPrimitive, readMemberTypes, readPrimitive } from "./nrbfByteReader";
import {
  BinaryType,
  MAX_ARRAY_LENGTH,
  Rec,
  type ClassMetadata,
  type NrbfObject,
  type NrbfReadResult,
  type NrbfValue,
} from "./nrbfTypes";

export { NrbfFormatError };
export { isNrbfObject, type NrbfObject, type NrbfValue, type NrbfReadResult } from "./nrbfTypes";

// Placeholder for an unresolved MemberReference; swapped out after parsing.
class Ref {
  readonly id: number;
  constructor(id: number) {
    this.id = id;
  }
}
// Run of N nulls (ObjectNullMultiple / ObjectNullMultiple256). Only legal as array elements.
class NullRun {
  readonly count: number;
  constructor(count: number) {
    this.count = count;
  }
}
type Raw = NrbfValue | Ref | NullRun | Raw[];

/**
 * Decode a decompressed BinaryFormatter stream.
 * @throws NrbfFormatError if the bytes aren't a BinaryFormatter stream or are malformed.
 */
export function readNrbf(bytes: Uint8Array): NrbfReadResult {
  // Every stream starts with a SerializedStreamHeader record. Checking up front
  // gives a clear error for "wrong file" instead of a failure deep in the parse.
  if (bytes.length < 17 || bytes[0] !== Rec.SerializedStreamHeader) {
    throw new NrbfFormatError("Not a .NET binary stream (missing BinaryFormatter header)");
  }

  const r = new ByteReader(bytes);
  const objects = new Map<number, Raw>();
  const metadata = new Map<number, ClassMetadata>();
  // Everything that can hold a Ref, for the post-parse resolution pass.
  const containers: (NrbfObject | Raw[])[] = [];
  let rootId: number | null = null;

  function checkLength(length: number) {
    if (!Number.isInteger(length) || length < 0 || length > MAX_ARRAY_LENGTH) {
      throw new NrbfFormatError(`Invalid array length ${length} at byte ${r.pos}`);
    }
  }

  /** A record that must be a single value (class member): null runs are illegal here. */
  function readValueRecord(): Raw {
    const v = readRecord();
    if (v instanceof NullRun) throw new NrbfFormatError(`Null run outside an array at byte ${r.pos}`);
    return v;
  }

  function readClassValues(objectId: number, meta: ClassMetadata): NrbfObject {
    const obj: NrbfObject = { $class: meta.name, members: {} };
    objects.set(objectId, obj);
    containers.push(obj);
    const members = obj.members as Record<string, Raw>;
    meta.memberNames.forEach((name, i) => {
      const t = meta.memberTypes[i];
      // Primitive members are written inline with no record header; every
      // other member type is a full record (string, reference, null, class...).
      members[name] = t.binaryType === BinaryType.Primitive
        ? readPrimitive(r, t.primitive!)
        : readValueRecord();
    });
    return obj;
  }

  function readElements(objectId: number, length: number, primitive: number | null): Raw[] {
    checkLength(length);
    const arr: Raw[] = [];
    objects.set(objectId, arr);
    containers.push(arr);
    while (arr.length < length) {
      if (primitive !== null) {
        arr.push(readPrimitive(r, primitive));
        continue;
      }
      const v = readRecord();
      if (v instanceof NullRun) {
        if (v.count > length - arr.length) {
          throw new NrbfFormatError(`Null run of ${v.count} overflows its array at byte ${r.pos}`);
        }
        for (let i = 0; i < v.count; i++) arr.push(null);
      } else {
        arr.push(v);
      }
    }
    return arr;
  }

  function readRecord(): Raw {
    const type = r.u8();
    switch (type) {
      case Rec.SerializedStreamHeader: {
        rootId = r.i32();
        r.i32(); // headerId
        const major = r.i32();
        r.i32(); // minor
        if (major !== 1) throw new NrbfFormatError("Not a .NET binary stream (unexpected BinaryFormatter version)");
        return readRecord();
      }
      case Rec.BinaryLibrary: // just a name registry; the real value follows
        r.i32();
        r.lps();
        return readRecord();
      case Rec.ClassWithId: {
        const objectId = r.i32();
        const meta = metadata.get(r.i32());
        if (!meta) throw new NrbfFormatError(`Unknown class metadata referenced at byte ${r.pos}`);
        metadata.set(objectId, meta);
        return readClassValues(objectId, meta);
      }
      case Rec.SystemClassWithMembers:
      case Rec.ClassWithMembers:
      case Rec.SystemClassWithMembersAndTypes:
      case Rec.ClassWithMembersAndTypes: {
        const objectId = r.i32();
        const name = r.lps();
        const count = r.i32();
        checkLength(count);
        const memberNames: string[] = [];
        for (let i = 0; i < count; i++) memberNames.push(r.lps());
        const typed = type === Rec.SystemClassWithMembersAndTypes || type === Rec.ClassWithMembersAndTypes;
        const memberTypes = typed
          ? readMemberTypes(r, count)
          : memberNames.map(() => ({ binaryType: BinaryType.Object as number }));
        if (type === Rec.ClassWithMembers || type === Rec.ClassWithMembersAndTypes) r.i32(); // libraryId
        const meta = { name, memberNames, memberTypes };
        metadata.set(objectId, meta);
        return readClassValues(objectId, meta);
      }
      case Rec.BinaryObjectString: {
        const objectId = r.i32();
        const value = r.lps();
        objects.set(objectId, value);
        return value;
      }
      case Rec.BinaryArray: {
        const objectId = r.i32();
        const arrayType = r.u8();
        const rank = r.i32();
        if (rank < 1 || rank > 32) throw new NrbfFormatError(`Invalid array rank ${rank} at byte ${r.pos}`);
        // Product of all dimensions, checked per step so it can't overflow.
        let length = 1;
        for (let i = 0; i < rank; i++) {
          const dim = r.i32();
          checkLength(dim);
          length *= dim;
          checkLength(length);
        }
        if (arrayType >= 3 && arrayType <= 5) for (let i = 0; i < rank; i++) r.i32(); // lower bounds (offset types)
        const [elementType] = readMemberTypes(r, 1);
        let primitive: number | null = null;
        if (elementType.binaryType === BinaryType.Primitive) {
          if (!isArrayPrimitive(elementType.primitive!)) {
            throw new NrbfFormatError(`Primitive type ${elementType.primitive} is not a valid array element`);
          }
          primitive = elementType.primitive!;
        }
        return readElements(objectId, length, primitive);
      }
      case Rec.MemberPrimitiveTyped:
        return readPrimitive(r, r.u8());
      case Rec.MemberReference:
        return new Ref(r.i32());
      case Rec.ObjectNull:
        return null;
      case Rec.ObjectNullMultiple256:
        return new NullRun(r.u8());
      case Rec.ObjectNullMultiple: {
        const count = r.i32();
        checkLength(count);
        return new NullRun(count);
      }
      case Rec.ArraySinglePrimitive: {
        const objectId = r.i32();
        const length = r.i32();
        const primitive = r.u8();
        if (!isArrayPrimitive(primitive)) {
          throw new NrbfFormatError(`Primitive type ${primitive} is not a valid array element`);
        }
        if (primitive === 2) {
          // byte[]: keep as bytes, not a number array. raw() bounds-checks length.
          checkLength(length);
          const value = r.raw(length).slice();
          objects.set(objectId, value);
          return value;
        }
        return readElements(objectId, length, primitive);
      }
      case Rec.ArraySingleObject:
      case Rec.ArraySingleString: {
        const objectId = r.i32();
        return readElements(objectId, r.i32(), null);
      }
      case Rec.MessageEnd:
        throw new NrbfFormatError(`Stream ended mid-object at byte ${r.pos - 1}`);
      default:
        throw new NrbfFormatError(`Record type ${type} at byte ${r.pos - 1} is not supported`);
    }
  }

  // Top-level records until MessageEnd. The root's referenced members arrive
  // as separate top-level records after it.
  for (;;) {
    const next = r.peek();
    if (next === -1) throw new NrbfFormatError("Stream is truncated (no MessageEnd record)");
    if (next === Rec.MessageEnd) break;
    const v = readRecord();
    if (v instanceof NullRun) throw new NrbfFormatError("Null run outside an array at top level");
  }

  // Resolve references in place now that every object id is known.
  const resolve = (v: Raw): Raw => (v instanceof Ref ? objects.get(v.id) ?? null : v);
  for (const c of containers) {
    if (Array.isArray(c)) {
      for (let i = 0; i < c.length; i++) c[i] = resolve(c[i]);
    } else {
      const members = c.members as Record<string, Raw>;
      for (const k of Object.keys(members)) members[k] = resolve(members[k]);
    }
  }

  if (rootId === null || !objects.has(rootId)) {
    throw new NrbfFormatError("Not a .NET binary stream (root object missing)");
  }
  return { root: objects.get(rootId) as NrbfValue };
}
