"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { StatusViagem } from "@prisma/client"
import { atualizarStatusViagem } from "@/lib/actions/viagens"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUS_VIAGEM_OPCOES, ehStatusViagem } from "@/lib/services/viagem-status.service"

type Props = {
  viagemId: number
  statusAtual: StatusViagem
}

export default function AtualizarStatusRapido({ viagemId, statusAtual }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [statusSelecionado, setStatusSelecionado] = useState<StatusViagem>(statusAtual)

  const alterarStatus = (novoStatus: string) => {
    if (!ehStatusViagem(novoStatus)) {
      setErro("Status inválido.")
      return
    }
    const status = novoStatus
    setStatusSelecionado(status)
    setErro("")

    startTransition(async () => {
      const resposta = await atualizarStatusViagem(viagemId, status)
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Erro ao atualizar status.")
        return
      }
      router.refresh()
    })
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
      {erro ? <p className="text-[11px] text-red-600">{erro}</p> : null}
    </div>
  )
}
