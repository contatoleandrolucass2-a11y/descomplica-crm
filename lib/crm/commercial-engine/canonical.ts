import { createHash } from "node:crypto";

export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function canonicalJsonError(): never {
  throw new TypeError("canonical JSON value is invalid");
}

function serializeCanonicalJsonValue(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) canonicalJsonError();
    return JSON.stringify(value);
  }
  if (typeof value !== "object") canonicalJsonError();

  if (ancestors.has(value)) canonicalJsonError();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) canonicalJsonError();
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const propertyNames = Object.keys(descriptors);
      if (
        propertyNames.length !== value.length + 1 ||
        !propertyNames.includes("length") ||
        propertyNames.some(
          (key) =>
            key !== "length" &&
            (!/^\d+$/.test(key) ||
              !Number.isSafeInteger(Number(key)) ||
              String(Number(key)) !== key),
        )
      ) {
        canonicalJsonError();
      }
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor?.enumerable || !("value" in descriptor)) canonicalJsonError();
        items.push(serializeCanonicalJsonValue(descriptor.value, ancestors));
      }
      return `[${items.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) canonicalJsonError();
    if (Object.getOwnPropertySymbols(value).length > 0) canonicalJsonError();

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).sort((left, right) =>
      Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
    );
    const entries = keys.map((key) => {
      const descriptor = descriptors[key]!;
      if (!descriptor.enumerable || !("value" in descriptor)) canonicalJsonError();
      return `${JSON.stringify(key)}:${serializeCanonicalJsonValue(descriptor.value, ancestors)}`;
    });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function serializeCanonicalJson(value: unknown): string {
  return serializeCanonicalJsonValue(value, new Set());
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(serializeCanonicalJson(value), "utf8").digest("hex");
}
