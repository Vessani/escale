/**
 * Fixa o fuso horário do processo Node em boot — quase todo cálculo de "hoje"/
 * jornada/folga do app usa Date local sem timezone explícito (ver
 * lib/utils/date-format.ts), então rodar sem TZ definido em produção
 * (ex: Vercel, que usa UTC por padrão) desloca "virada do dia" em até 3h.
 * Não sobrescreve um TZ já configurado manualmente no ambiente.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.TZ) {
    process.env.TZ = "America/Sao_Paulo"
  }
}
