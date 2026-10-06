"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { StatusViagem } from "@prisma/client"
import { atualizarStatusViagem } from "@/lib/actions/viagens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog } from "radix-ui"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { classeBadgeStatusViagem, classePontoStatusViagem } from "./badge-styles"
import {
  STATUS_VIAGEM_OPCOES,
  ehStatusViagem,
  formatarStatusViagem,
  normalizarStatusViagem,
  type StatusViagemSelecionavel,
} from "@/lib/services/viagem-status.service"
import { chamarAcao } from "@/lib/chamar-acao"

type Props = {
  viagemId: number
  statusAtual: StatusViagem
  inicioPrevisto: string | Date
  fimPrevisto: string | Date
  /**
   * Restringe as trocas oferecidas (ex: Dashboard só oferece o ciclo da
   * viagem em andamento — ver STATUS_ALTERAVEIS_NO_DASHBOARD). O status
   * atual sempre aparece na lista, desabilitado se não estiver entre elas.
   */
  opcoesPermitidas?: readonly StatusViagem[]
}

export default function AtualizarStatusRapido({ viagemId, statusAtual, inicioPrevisto, fimPrevisto, opcoesPermitidas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [statusSelecionado, setStatusSelecionado] = useState<StatusViagemSelecionavel>(normalizarStatusViagem(statusAtual))
  const [dialogPostergarAberto, setDialogPostergarAberto] = useState(false)
  const [novoInicio, setNovoInicio] = useState(() => formatDateTimeForInput(inicioPrevisto))
  const [novoFim, setNovoFim] = useState(() => formatDateTimeForInput(fimPrevisto))

  const confirmarStatus = (novoStatus: StatusViagemSelecionavel, novaData?: { inicioPrevisto: string; fimPrevisto: string }) => {
    setErro("")

    startTransition(async () => {
      const resposta = await chamarAcao(() => atualizarStatusViagem(viagemId, novoStatus, novaData))
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível atualizar o status.")
        return
      }
      setDialogPostergarAberto(false)
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
      // Postergada exige a nova data — abre um diálogo à parte pra revisar/
      // ajustar os campos e confirmar, em vez de expandir a célula da tabela
      // (o conteúdo extra quebrava o layout das colunas vizinhas).
      setErro("")
      setDialogPostergarAberto(true)
      return
    }

    confirmarStatus(novoStatusBruto)
  }

  const cancelarPostergar = () => {
    setDialogPostergarAberto(false)
    // Sem confirmação, volta o select pro status real da viagem.
    setStatusSelecionado(normalizarStatusViagem(statusAtual))
  }

  return (
    <div className="space-y-1">
      {/*
        Um controle só: o seletor É a etiqueta colorida do status (antes havia
        a etiqueta e, embaixo, um select repetindo o mesmo texto).
      */}
      <Select value={statusSelecionado} onValueChange={alterarStatus} disabled={isPending}>
        <SelectTrigger
          aria-label="Status da viagem"
          className={cn("h-7 w-auto gap-1.5 border px-2.5 text-xs font-medium", classeBadgeStatusViagem(statusSelecionado))}
        >
          {/*
            Conteúdo explícito (e não o texto copiado da opção): assim a
            etiqueta já vem pronta do servidor, sem piscar vazia até o
            JavaScript carregar.
          */}
          <SelectValue placeholder="Status">
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", classePontoStatusViagem(statusSelecionado))} />
              {formatarStatusViagem(statusSelecionado)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_VIAGEM_OPCOES.filter(
            (opcao) => !opcoesPermitidas || opcoesPermitidas.includes(opcao.valor) || opcao.valor === statusSelecionado,
          ).map((opcao) => (
            <SelectItem
              key={opcao.valor}
              value={opcao.valor}
              disabled={Boolean(opcoesPermitidas) && !opcoesPermitidas?.includes(opcao.valor)}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", classePontoStatusViagem(opcao.valor))} />
                {opcao.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {erro ? <p className="text-[11px] text-destructive">{erro}</p> : null}

      <Dialog.Root open={dialogPostergarAberto} onOpenChange={(aberto) => !aberto && cancelarPostergar()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-foreground">Postergar viagem</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-foreground/80">
              Informe a nova data de início e fim previstos.
            </Dialog.Description>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/80">Novo início previsto</label>
                <Input
                  type="datetime-local"
                  value={novoInicio}
                  disabled={isPending}
                  onChange={(evento) => setNovoInicio(evento.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/80">Novo fim previsto</label>
                <Input type="datetime-local" value={novoFim} disabled={isPending} onChange={(evento) => setNovoFim(evento.target.value)} />
              </div>
            </div>

            {erro ? (
              <Alert variant="error" className="mt-3">
                {erro}
              </Alert>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={cancelarPostergar}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isPending || !novoInicio || !novoFim}
                onClick={() => confirmarStatus("POSTERGADA", { inicioPrevisto: novoInicio, fimPrevisto: novoFim })}
              >
                {isPending ? "Salvando..." : "Confirmar nova data"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
