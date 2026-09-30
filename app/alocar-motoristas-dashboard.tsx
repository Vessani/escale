"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { atualizarAlocacaoViagem } from "@/lib/actions/viagens"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { OpcoesMotoristaAcompanhante, OpcoesMotoristaPrincipal, ValorMotoristaSelecionado, type OpcaoMotorista } from "@/components/motorista/opcoes-motorista"

type Props = {
  viagemId: number
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
  /** Já com a situação de cada motorista calculada no servidor (ver montarOpcoesMotoristaPorViagem). */
  opcoes: OpcaoMotorista[]
}

/** Alocação inline do Dashboard — grava direto, sem passar pela tela de edição completa (ver atualizarAlocacaoViagem). */
export default function AlocarMotoristasDashboard({ viagemId, motoristaId, motoristaAcompanhanteId, opcoes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [principal, setPrincipal] = useState<number | null>(motoristaId)
  const [acompanhante, setAcompanhante] = useState<number | null>(motoristaAcompanhanteId)

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
        <SelectTrigger className="h-8 bg-card text-xs">
          <ValorMotoristaSelecionado opcoes={opcoes} selecionadoId={principal} mostrarSituacao placeholder="Selecionar motorista..." />
        </SelectTrigger>
        <SelectContent>
          <OpcoesMotoristaPrincipal motoristas={opcoes} selecionadoId={principal} />
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
        <SelectTrigger className="h-7 bg-card text-[11px] text-muted-foreground">
          <ValorMotoristaSelecionado opcoes={opcoes} selecionadoId={acompanhante} mostrarSituacao={false} placeholder="Sem acompanhante" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhum">Sem acompanhante</SelectItem>
          <OpcoesMotoristaAcompanhante motoristas={opcoes} selecionadoId={acompanhante} />
        </SelectContent>
      </Select>

      {erro ? <p className="text-[11px] text-destructive">{erro}</p> : null}
    </div>
  )
}
