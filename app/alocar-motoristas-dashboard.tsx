"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Turno } from "@prisma/client"
import { atualizarAlocacaoViagem } from "@/lib/actions/viagens"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motoristaEhCompativel } from "@/lib/services/alocacao.service"
import { mapearRegistrosJornada } from "@/lib/services/jornada.service"
import { inicioDoDia } from "@/lib/utils/date-format"
import { rotularMotoristaParaSelect } from "@/lib/utils/motorista-format"

type MotoristaParaAlocacao = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  liberado: boolean
  disponivel: boolean
  integracao: Array<{
    cliente: string
    status: "ATIVO" | "INATIVO" | "PENDENTE"
    dataValidade: string | Date
  }>
  registrosJornada: Array<{ data: string | Date; codigo: number }>
  jornadaRelatorioInicio: string | Date | null
  jornadaRelatorioFim: string | Date | null
}

type Props = {
  viagemId: number
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
  motoristas: MotoristaParaAlocacao[]
  turno: Turno
  diasViagem: number
  inicioPrevisto: string | Date
  integracaoExigida: string | null
}

/** Alocação inline do Dashboard — grava direto, sem passar pela tela de edição completa (ver atualizarAlocacaoViagem). */
export default function AlocarMotoristasDashboard({
  viagemId,
  motoristaId,
  motoristaAcompanhanteId,
  motoristas,
  turno,
  diasViagem,
  inicioPrevisto,
  integracaoExigida,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [principal, setPrincipal] = useState<number | null>(motoristaId)
  const [acompanhante, setAcompanhante] = useState<number | null>(motoristaAcompanhanteId)
  const hoje = useMemo(() => inicioDoDia(new Date()), [])

  const salvar = (novoPrincipal: number | null, novoAcompanhante: number | null) => {
    setErro("")
    startTransition(async () => {
      const resposta = await atualizarAlocacaoViagem(viagemId, {
        motoristaId: novoPrincipal,
        motoristaAcompanhanteId: novoAcompanhante,
      })
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível atualizar a alocação.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="min-w-[190px] space-y-1">
      <Select
        value={principal === null ? "" : String(principal)}
        onValueChange={(value) => {
          const novo = value ? Number(value) : null
          setPrincipal(novo)
          salvar(novo, acompanhante)
        }}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 bg-white text-xs">
          <SelectValue placeholder="Selecionar motorista..." />
        </SelectTrigger>
        <SelectContent>
          {motoristas.map((motorista) => {
            const compativel = motoristaEhCompativel(
              { ...motorista, registrosJornada: mapearRegistrosJornada(motorista.registrosJornada) },
              {
                turnoViagem: turno,
                diasViagem,
                dataInicioViagem: new Date(inicioPrevisto),
                integracaoExigida,
                hoje,
              },
            )
            const rotulo = rotularMotoristaParaSelect(compativel, motorista.disponivel)

            return (
              <SelectItem key={motorista.id} value={String(motorista.id)}>
                {motorista.nome} {rotulo}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select
        value={acompanhante === null ? "nenhum" : String(acompanhante)}
        onValueChange={(value) => {
          const novo = value === "nenhum" ? null : Number(value)
          setAcompanhante(novo)
          salvar(principal, novo)
        }}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 bg-white text-[11px] text-slate-500">
          <SelectValue placeholder="+ acompanhante" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhum">Sem acompanhante</SelectItem>
          {motoristas.map((motorista) => (
            <SelectItem key={motorista.id} value={String(motorista.id)}>
              {motorista.nome} {!motorista.liberado && "(Em treinamento)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {erro ? <p className="text-[11px] text-destructive">{erro}</p> : null}
    </div>
  )
}
