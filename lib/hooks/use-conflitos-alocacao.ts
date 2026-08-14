"use client"

import { useMemo } from "react"
import { periodosConflitamComDescanso } from "@/lib/services/alocacao.service"

export type ItemParaConflitoAlocacao = {
  /** Identificador único do item na lista em revisão — id da viagem (já existente) ou numViagem (ainda não criada). */
  chave: string
  /** Número da viagem exibido nas mensagens de conflito — pode ser igual a `chave`. */
  numViagem: string
  /** Id do motorista sugerido automaticamente, como string (vazio quando não há sugestão). */
  motoristaSugeridoId: string
  inicioPrevisto: string | Date
  fimPrevisto: string | Date
}

/**
 * Para uma lista de viagens em revisão (alocação manual de viagens já
 * existentes, ou revisão de importação em lote antes de criar), calcula:
 * - a seleção efetiva de motorista por viagem (explícita do usuário ou, na
 *   falta, a sugestão automática);
 * - os conflitos: viagens que têm o mesmo motorista selecionado sem o
 *   descanso mínimo entre elas (ver periodosConflitamComDescanso).
 * Só avisa — não troca nada automaticamente, quem decide é o usuário.
 * Compartilhado entre app/viagens/alocacao/viagens-alocacao-client.tsx e
 * components/viagem/confirmar-lote-viagens.tsx, que tinham essa mesma lógica
 * duplicada.
 */
export function useConflitosAlocacao(
  itens: ItemParaConflitoAlocacao[],
  selecoes: Record<string, string>,
) {
  const selecaoEfetivaPorViagem = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const item of itens) {
      mapa[item.chave] = selecoes[item.chave] || item.motoristaSugeridoId
    }
    return mapa
  }, [itens, selecoes])

  const conflitosPorViagem = useMemo(() => {
    const mapa: Record<string, string[]> = {}

    for (const itemA of itens) {
      const motoristaA = selecaoEfetivaPorViagem[itemA.chave]
      if (!motoristaA) continue

      const numerosConflitantes = itens
        .filter((itemB) => {
          if (itemB.chave === itemA.chave) return false
          if (selecaoEfetivaPorViagem[itemB.chave] !== motoristaA) return false

          return periodosConflitamComDescanso(
            new Date(itemA.inicioPrevisto),
            new Date(itemA.fimPrevisto),
            new Date(itemB.inicioPrevisto),
            new Date(itemB.fimPrevisto),
          )
        })
        .map((itemB) => itemB.numViagem)

      if (numerosConflitantes.length > 0) {
        mapa[itemA.chave] = numerosConflitantes
      }
    }

    return mapa
  }, [itens, selecaoEfetivaPorViagem])

  return { selecaoEfetivaPorViagem, conflitosPorViagem }
}
