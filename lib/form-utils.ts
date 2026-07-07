export function normalizeFormValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }

  return ""
}
