import { describe, it, expect } from "vitest";
import { readNrbf, NrbfFormatError, type NrbfObject } from "../utils/nrbfReader";
import { NrbfWriter, PrimitiveType as PT } from "./helpers/nrbfWriter";

// A MessageEnd record byte, for hand-terminated malformed streams.
const MESSAGE_END = 11;

describe("readNrbf — decoding", () => {
  it("reads a class with primitive, string and nested-class members", () => {
    const w = new NrbfWriter()
      .header(1)
      .library(2, "Assembly-CSharp")
      .classWithMembersAndTypes(1, "Root", [
        ["count", { kind: "primitive", primitive: PT.int32 }],
        ["ratio", { kind: "primitive", primitive: PT.double }],
        ["flag", { kind: "primitive", primitive: PT.boolean }],
        ["label", { kind: "string" }],
        ["child", { kind: "class", className: "Child", libraryId: 2 }],
      ], 2);
    w.primitive(PT.int32, 42);
    w.primitive(PT.double, 1.5);
    w.primitive(PT.boolean, true);
    w.string(3, "hello");
    w.classWithMembersAndTypes(4, "Child", [["value__", { kind: "primitive", primitive: PT.int32 }]], 2);
    w.primitive(PT.int32, 7);
    const root = readNrbf(w.end()).root as NrbfObject;

    expect(root.$class).toBe("Root");
    expect(root.members.count).toBe(42);
    expect(root.members.ratio).toBe(1.5);
    expect(root.members.flag).toBe(true);
    expect(root.members.label).toBe("hello");
    expect((root.members.child as NrbfObject).members.value__).toBe(7);
  });

  it("reads Int64 as bigint and DateTime as ticks with the Kind bits masked off", () => {
    const w = new NrbfWriter()
      .header(1)
      .library(2, "Lib")
      .classWithMembersAndTypes(1, "Root", [
        ["big", { kind: "primitive", primitive: PT.int64 }],
        ["when", { kind: "primitive", primitive: PT.dateTime }],
      ], 2);
    w.primitive(PT.int64, 9007199254740993n); // > Number.MAX_SAFE_INTEGER
    w.primitive(PT.dateTime, 639249775310892470n | (1n << 62n)); // Kind = Local
    const root = readNrbf(w.end()).root as NrbfObject;

    expect(root.members.big).toBe(9007199254740993n);
    expect(root.members.when).toBe(639249775310892470n);
  });

  it("decodes multi-byte length prefixes and non-ASCII strings", () => {
    const long = "x".repeat(300); // length needs a 2-byte varint
    const w = new NrbfWriter().header(1).library(2, "Lib").arraySingleObject(1, 2);
    w.string(3, long);
    w.string(4, "Ancestral ★★");
    expect(readNrbf(w.end()).root).toEqual([long, "Ancestral ★★"]);
  });

  it("resolves member references, including forward references to later records", () => {
    const w = new NrbfWriter()
      .header(1)
      .library(2, "Lib")
      .classWithMembersAndTypes(1, "Root", [
        ["a", { kind: "string" }],
        ["b", { kind: "string" }],
        ["later", { kind: "object" }],
      ], 2);
    w.string(10, "shared");
    w.reference(10); // back-reference to an already-read string
    w.reference(20); // forward reference: defined after the root finishes
    w.arraySinglePrimitive(20, PT.int32, [1, 2, 3]);
    const root = readNrbf(w.end()).root as NrbfObject;

    expect(root.members.a).toBe("shared");
    expect(root.members.b).toBe("shared");
    expect(root.members.later).toEqual([1, 2, 3]);
  });

  it("resolves references inside arrays and preserves object identity through cycles", () => {
    const w = new NrbfWriter()
      .header(1)
      .library(2, "Lib")
      .classWithMembersAndTypes(1, "Node", [
        ["self", { kind: "object" }],
        ["siblings", { kind: "object" }],
      ], 2);
    w.reference(1);  // points at itself
    w.reference(5);
    w.arraySingleObject(5, 2);
    w.reference(1);  // array element referencing the root
    w.nullRecord();
    const root = readNrbf(w.end()).root as NrbfObject;

    expect(root.members.self).toBe(root);
    expect((root.members.siblings as unknown[])[0]).toBe(root);
    expect((root.members.siblings as unknown[])[1]).toBeNull();
  });

  it("reuses class metadata via ClassWithId", () => {
    const w = new NrbfWriter().header(1).library(2, "Lib").arraySingleObject(1, 2);
    w.classWithMembersAndTypes(3, "Item", [["n", { kind: "primitive", primitive: PT.int32 }]], 2);
    w.primitive(PT.int32, 1);
    w.classWithId(4, 3);
    w.primitive(PT.int32, 2);
    const root = readNrbf(w.end()).root as NrbfObject[];

    expect(root.map((o) => [o.$class, o.members.n])).toEqual([["Item", 1], ["Item", 2]]);
  });

  it("expands both null-run record types and reads typed primitive elements", () => {
    const w = new NrbfWriter().header(1).library(2, "Lib").arraySingleObject(1, 6);
    w.primitiveRecord(PT.int32, 5);
    w.nullMultiple(2);                 // ObjectNullMultiple256
    w.rawBytes(14).rawInt32(2);        // ObjectNullMultiple (int32 count)
    w.primitiveRecord(PT.boolean, true);
    expect(readNrbf(w.end()).root).toEqual([5, null, null, null, null, true]);
  });

  // Real playerInfo.dat files contain a rank-2 array — rejecting these broke
  // the import on a real save. Decoded flattened in row-major order.
  it("decodes a multi-dimensional array as a flat, row-major array", () => {
    const bytes = new NrbfWriter().header(1)
      .rawBytes(7).rawInt32(1)            // BinaryArray, objectId 1
      .rawBytes(2).rawInt32(2)            // type Rectangular, rank 2
      .rawInt32(2).rawInt32(2)            // lengths 2 x 2
      .rawBytes(0, PT.int32)              // element type: primitive Int32
      .rawInt32(1).rawInt32(2).rawInt32(3).rawInt32(4)
      .rawBytes(MESSAGE_END).bytesSoFar();
    expect(readNrbf(bytes).root).toEqual([1, 2, 3, 4]);
  });

  it("rejects a multi-dimensional array whose total size is absurd", () => {
    const bytes = new NrbfWriter().header(1)
      .rawBytes(7).rawInt32(1).rawBytes(2).rawInt32(2)
      .rawInt32(100000).rawInt32(100000)  // 10^10 elements
      .rawBytes(0, PT.int32, MESSAGE_END).bytesSoFar();
    expect(() => readNrbf(bytes)).toThrow(/invalid array length/i);
  });

  it("returns a byte[] as a Uint8Array", () => {
    const w = new NrbfWriter().header(1).arraySinglePrimitive(1, PT.byte, [0, 127, 255]);
    const root = readNrbf(w.end()).root;
    expect(root).toBeInstanceOf(Uint8Array);
    expect(Array.from(root as Uint8Array)).toEqual([0, 127, 255]);
  });
});

describe("readNrbf — rejecting bad input", () => {
  it("rejects bytes that are not a BinaryFormatter stream", () => {
    expect(() => readNrbf(new TextEncoder().encode('{"pulls":[]}'))).toThrow(NrbfFormatError);
  });

  it("rejects an unexpected BinaryFormatter version", () => {
    const w = new NrbfWriter().rawBytes(0).rawInt32(1).rawInt32(-1).rawInt32(2).rawInt32(0);
    w.arraySingleObject(1, 0);
    expect(() => readNrbf(w.end())).toThrow(/version/i);
  });

  it("rejects a truncated stream instead of reading past the end", () => {
    const bytes = new NrbfWriter().header(1).library(2, "Lib").end();
    expect(() => readNrbf(bytes.slice(0, bytes.length - 3))).toThrow(/truncated/i);
  });

  it("rejects unsupported record types", () => {
    const remoting = new NrbfWriter().header(1).rawBytes(21, 0, 0, 0, 0).end();
    expect(() => readNrbf(remoting)).toThrow(/not supported/i);
  });

  // HARDENING REGRESSIONS: each input below used to hang the tab or exhaust
  // memory (found in review). If one of these tests hangs, the guard broke.
  it("rejects a string length that overflows to negative (was an infinite loop)", () => {
    const bytes = new NrbfWriter().header(1)
      .rawBytes(6).rawInt32(1).rawBytes(0xf6, 0xff, 0xff, 0xff, 0x0f, MESSAGE_END)
      .bytesSoFar();
    expect(() => readNrbf(bytes)).toThrow(/length overflows/i);
  });

  it("rejects a null run longer than its array (was out-of-memory)", () => {
    const huge = new NrbfWriter().header(1).arraySingleObject(1, 1).rawBytes(14).rawInt32(0x7fffffff).end();
    expect(() => readNrbf(huge)).toThrow(NrbfFormatError);

    const small = new NrbfWriter().header(1).arraySingleObject(1, 1).nullMultiple(3).end();
    expect(() => readNrbf(small)).toThrow(/overflows its array/i);
  });

  it("rejects zero-byte element types in primitive arrays (was out-of-memory)", () => {
    const bytes = new NrbfWriter().header(1)
      .rawBytes(15).rawInt32(1).rawInt32(0x7fffffff).rawBytes(17, MESSAGE_END)
      .bytesSoFar();
    expect(() => readNrbf(bytes)).toThrow(/not a valid array element/i);
  });

  it("rejects absurd declared array lengths before allocating", () => {
    const bytes = new NrbfWriter().header(1).arraySingleObject(1, 0x7fffffff).end();
    expect(() => readNrbf(bytes)).toThrow(/invalid array length/i);
  });

  it("rejects a null run used as a class member", () => {
    const w = new NrbfWriter().header(1).library(2, "Lib")
      .classWithMembersAndTypes(1, "Root", [["m", { kind: "object" }]], 2);
    w.nullMultiple(3);
    expect(() => readNrbf(w.end())).toThrow(/outside an array/i);
  });
});
