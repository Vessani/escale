"use client"

import { useEffect, useState } from "react"
import { useWatch, type Control } from "react-hook-form"
import type { OpcaoMotorista } from "@/components/motorista/opcoes-motorista"
import { opcoesMotoristaDaEdicao } from "@/lib/actions/viagens"
import { mensagemDaFalha } from "@/lib/chamar-acao"
import { tentarConverterEntradaDeDataHora } from "@/lib/utils/date-format"
import type { EditarViagemFormValues } from "@/lib/validation/viagens"

/** Espera a pessoa parar de digitar a data antes de pedir a lista de novo. */
const ESPERA_MS = 500

type Resultado = { chave: string; opcoes: OpcaoMotorista[]; erro: string | null }

/**
 * Lista de motoristas da edição acompanhando o formulário: mudou início,
 * fim, turno ou produto, pede ao servidor a situação de cada motorista com
 * os valores novos (opcoesMotoristaDaEdicao). Enquanto o período está
 * incompleto ou invertido, mantém a última lista em vez de mostrar uma
 * situação calculada com data pela metade.
 */
export function useOpcoesMotoristaDaEdicao(viagemId: number, opcoesIniciais: OpcaoMotorista[], control: Control<EditarViagemFormValues>) {
  const [inicioPrevisto, fimPrevisto, turno, produto] = useWatch({
    control,
    name: ["inicioPrevisto", "fimPrevisto", "turno", "produto"],
  })
  const chave = JSON.stringify([inicioPrevisto, fimPrevisto, turno, produto ?? null])
  const inicio = tentarConverterEntradaDeDataHora(inicioPrevisto)
  const fim = tentarConverterEntradaDeDataHora(fimPrevisto)
  const periodoValido = inicio !== null && fim !== null && fim.getTime() >= inicio.getTime()

  // A lista que veio com a página vale para os valores com que o formulário abriu.
  const [resultado, setResultado] = useState<Resultado>(() => ({ chave, opcoes: opcoesIniciais, erro: null }))

  useEffect(() => {
    if (!periodoValido || chave === resultado.chave) return

    let cancelado = false
    const espera = setTimeout(async () => {
      try {
        const resposta = await opcoesMotoristaDaEdicao(viagemId, {
          inicioPrevisto: String(inicioPrevisto),
          fimPrevisto: String(fimPrevisto),
          turno,
          produto: produto ?? null,
        })
        if (cancelado) return
        setResultado((atual) =>
          resposta.sucesso ? { chave, opcoes: resposta.opcoes, erro: null } : { ...atual, chave, erro: resposta.erro },
        )
      } catch (erro) {
        if (!cancelado) setResultado((atual) => ({ ...atual, chave, erro: mensagemDaFalha(erro) }))
      }
    }, ESPERA_MS)

    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [chave, periodoValido, resultado.chave, viagemId, inicioPrevisto, fimPrevisto, turno, produto])

  return {
    opcoes: resultado.opcoes,
    erro: resultado.erro,
    atualizando: periodoValido && chave !== resultado.chave,
  }
}
