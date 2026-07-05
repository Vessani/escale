export function formatarDataHoraPtBr(data: Date | string) {
  const dataNormalizada = data instanceof Date ? data : new Date(data)

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dataNormalizada)
}
