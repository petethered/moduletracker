/**
 * nrbfTypes.ts — public output types and MS-NRBF format constants for
 * nrbfReader.ts. Import the public types from nrbfReader.ts (it re-exports
 * them); this file exists to keep the decoder itself small.
 */

export interface NrbfObject {
  $class: string;
  members: Record<string, NrbfValue>;
}

export type NrbfValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | NrbfObject
  | NrbfValue[];

export interface NrbfReadResult {
  root: NrbfValue;
}

/** True for a decoded class instance (not an array, byte array, or scalar). */
export function isNrbfObject(v: NrbfValue | undefined): v is NrbfObject {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
}

// MS-NRBF BinaryTypeEnum. A plain object (not a TS enum): the app tsconfig
// sets erasableSyntaxOnly, which forbids enums.
export const BinaryType = {
  Primitive: 0,
  String: 1,
  Object: 2,
  SystemClass: 3,
  Class: 4,
  ObjectArray: 5,
  StringArray: 6,
  PrimitiveArray: 7,
} as const;

// MS-NRBF RecordTypeEnum values handled below.
export const Rec = {
  SerializedStreamHeader: 0,
  ClassWithId: 1,
  SystemClassWithMembers: 2,
  ClassWithMembers: 3,
  SystemClassWithMembersAndTypes: 4,
  ClassWithMembersAndTypes: 5,
  BinaryObjectString: 6,
  BinaryArray: 7,
  MemberPrimitiveTyped: 8,
  MemberReference: 9,
  ObjectNull: 10,
  MessageEnd: 11,
  BinaryLibrary: 12,
  ObjectNullMultiple256: 13,
  ObjectNullMultiple: 14,
  ArraySinglePrimitive: 15,
  ArraySingleObject: 16,
  ArraySingleString: 17,
} as const;

export interface MemberType {
  binaryType: number;
  /** PrimitiveTypeEnum, for Primitive / PrimitiveArray members. */
  primitive?: number;
}
export interface ClassMetadata {
  name: string;
  memberNames: string[];
  memberTypes: MemberType[];
}

/**
 * Upper bound on any declared array length. Real saves top out in the low
 * thousands; this only exists so a corrupt length can't request a
 * multi-gigabyte allocation. 2^24 elements is still far above anything legit.
 */
export const MAX_ARRAY_LENGTH = 1 << 24;
