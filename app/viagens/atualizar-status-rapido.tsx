"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { StatusViagem } from "@prisma/client"
import { atualizarStatusViagem } from "@/lib/actions/viagens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import {
  STATUS_VIAGEM_OPCOES,
  ehStatusViagem,
  normalizarStatusViagem,
  type StatusViagemSelecionavel,
} from "@/lib/services/viagem-status.service"

type Props = {
  viagemId: number
  statusAtual: StatusViagem
  inicioPrevisto: string | Date
  fimPrevisto: string | Date
}

export default function AtualizarStatusRapido({ viagemId, statusAtual, inicioPrevisto, fimPrevisto }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [statusSelecionado, setStatusSelecionado] = useState<StatusViagemSelecionavel>(
    normalizarStatusViagem(statusAtual),
  )
  const [novoInicio, setNovoInicio] = useState(() => formatDateTimeForInput(inicioPrevisto))
  const [novoFim, setNovoFim] = useState(() => formatDateTimeForInput(fimPrevisto))

  const confirmarStatus = (novoStatus: StatusViagemSelecionavel, novaData?: { inicioPrevisto: string; fimPrevisto: string }) => {
    setErro("")

    startTransition(async () => {
      const resposta = await atualizarStatusViagem(viagemId, novoStatus, novaData)
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Erro ao atualizar status.")
        return
      }
      router.refresh()
    })
  }

  const alterarStatus = (novoStatusBruto: string) => {
    if (!ehStatusViagem(novoStatusBruto)) {
      setErro("Status inválido.")
      return
    }
    setStatusSelecionado(novoStatusBruto)

    if (novoStatusBruto === "POSTERGADA") {
      // Postergada exige a nova data — espera o usuário revisar/ajustar os
      // campos abaixo e confirmar, em vez de gravar na hora.
      setErro("")
      return
    }

    confirmarStatus(novoStatusBruto)
  }

  return (
    <div className="space-y-1">
      <Select value={statusSelecionado} onValueChange={alterarStatus} disabled={isPending}>
        <SelectTrigger className="h-8 bg-white text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
            {STATUS_VIAGEM_OPCOES.map((opcao) => (
            <SelectItem key={opcao.valor} value={opcao.valor}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {statusSelecionado === "POSTERGADA" && (
        <div className="space-y-1.5 rounded border border-amber-200 bg-amber-50 p-2">
          <p className="text-[11px] font-medium text-amber-800">Nova data da viagem</p>
          <Input
            type="datetime-local"
            className="h-7 bg-white text-xs"
            value={novoInicio}
            onChange={(evento) => setNovoInicio(evento.target.value)}
            disabled={isPending}
          />
          <Input
            type="datetime-local"
            className="h-7 bg-white text-xs"
            value={novoFim}
            onChange={(evento) => setNovoFim(evento.target.value)}
            disabled={isPending}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={isPending || !novoInicio || !novoFim}
            onClick={() => confirmarStatus("POSTERGADA", { inicioPrevisto: novoInicio, fimPrevisto: novoFim })}
          >
            Confirmar nova data
          </Button>
        </div>
      )}

      {erro ? <p className="text-[11px] text-destructive">{erro}</p> : null}
    </div>
  )
}
