export function serializeData<T>(data: T): T {
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
  })) as T;
}
