import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

/**
 * Filial que a torre está vendo. A torre não pertence a nenhuma filial (o
 * cadastro dela tem filialId nulo): escolhe qual acompanhar no menu, e a
 * escolha fica num cookie do navegador. O cookie só diz QUAL filial mostrar,
 * nunca dá permissão — a torre já vê todas, e o papel continua barrado em
 * toda escrita (ver auth-guard.ts).
 */
export const COOKIE_FILIAL_TORRE = "escale-torre-filial"

/** Lembra a escolha por 30 dias; a sessão em si continua valendo só 12h. */
const VALIDADE_COOKIE_SEGUNDOS = 30 * 24 * 60 * 60

/** Valor do cookie → id da filial; qualquer coisa que não seja um inteiro positivo vira null. */
export function lerIdDoCookie(valor: string | undefined): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null
  const id = Number(valor)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * A filial escolhida, se ainda existir; senão a primeira em ordem
 * alfabética (primeiro acesso, ou filial escolhida que foi removida).
 * Null só quando não há nenhuma filial cadastrada.
 */
export async function filialDaTorre(): Promise<number | null> {
  const escolhida = lerIdDoCookie((await cookies()).get(COOKIE_FILIAL_TORRE)?.value)
  if (escolhida !== null) {
    const existe = await prisma.filial.findUnique({ where: { id: escolhida }, select: { id: true } })
    if (existe) return existe.id
  }
  const primeira = await prisma.filial.findFirst({ orderBy: { nome: "asc" }, select: { id: true } })
  return primeira?.id ?? null
}

export async function gravarFilialDaTorre(filialId: number) {
  ;(await cookies()).set(COOKIE_FILIAL_TORRE, String(filialId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_COOKIE_SEGUNDOS,
  })
}
