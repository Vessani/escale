type DecimalLike = {
  d: unknown
  e: unknown
  s: unknown
}

export type SerializedData<T> =
  T extends Date ? string :
  T extends DecimalLike ? number :
  T extends Array<infer U> ? SerializedData<U>[] :
  T extends object ? { [K in keyof T]: SerializedData<T[K]> } :
  T

export function serializeData<T>(data: T): SerializedData<T> {
  return JSON.parse(JSON.stringify(data, (_, value) => {
    // Handle Decimal types from Prisma
    if (value && typeof value === 'object' && 'd' in value && 's' in value && 'e' in value) {
      return Number(value);
    }
    // Handle Date types
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  })) as SerializedData<T>;
}
