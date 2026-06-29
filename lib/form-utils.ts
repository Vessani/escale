export function normalizeFormValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }

  return ""
}

export function formatDateForDateInput(value: Date | string) {
  const instant = new Date(value)
  const localDate = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

export function formatDateTimeForInput(value: Date | string) {
  const instant = new Date(value)
  const localDate = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}
