"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Popover } from "radix-ui"
import { Clock, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { atualizarSaidaReal } from "@/lib/actions/viagens"
import { formatDateTimeForInput, formatarHoraLocal, tentarConverterEntradaDeDataHora } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { TOLERANCIA_SAIDA_MINUTOS, minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { MOTIVOS_ATRASO } from "@/lib/services/motivos-atraso"
import { chamarAcao } from "@/lib/chamar-acao"

type Props = {
  viagemId: number
  inicioPrevisto: string | Date
  horarioRealSaidaInicial: string | Date | null
  motivoAtrasoInicial: string | null
}

/** "+25 min", "+1h 10" — atraso da saída real em relação ao início previsto. */
function formatarAtraso(minutos: number): string {
  if (minutos < 60) return `+${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `+${horas}h` : `+${horas}h ${String(resto).padStart(2, "0")}`
}

/**
 * Saída real no Dashboard: fechada, mostra só o horário (e o atraso, se
 * houver) — ou um botão "Registrar saída" quando ainda não saiu. Clicando,
 * abre um painel pequeno pra informar horário e observação. Antes eram dois
 * campos de formulário sempre abertos em cada linha, que alargavam a tabela
 * e mostravam "dd/mm/aaaa --:--" nas viagens que ainda não saíram.
 */
export default function AtualizarSaidaReal({
  viagemId,
  inicioPrevisto,
  horarioRealSaidaInicial,
  motivoAtrasoInicial,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState("")
  const salvoHorario = horarioRealSaidaInicial ? formatDateTimeForInput(horarioRealSaidaInicial) : ""
  const salvoMotivo = motivoAtrasoInicial ?? ""
  const [horario, setHorario] = useState(salvoHorario)
  const [motivo, setMotivo] = useState(salvoMotivo)

  const minutosAtraso = horarioRealSaidaInicial ? minutosDeAtraso(inicioPrevisto, horarioRealSaidaInicial) : 0

  const abrirOuFechar = (proximo: boolean) => {
    // Reabrir sempre parte do que está salvo, não de um rascunho abandonado.
    if (proximo) {
      setHorario(salvoHorario)
      setMotivo(salvoMotivo)
      setErro("")
    }
    setAberto(proximo)
  }

  const salvar = (proximoHorario: string, proximoMotivo: string) => {
    setErro("")
    if (proximoHorario && !tentarConverterEntradaDeDataHora(proximoHorario)) {
      setErro("Data/hora incompleta ou inválida. Confira dia, mês, ano e hora.")
      return
    }
    startTransition(async () => {
      const resposta = await chamarAcao(() =>
        atualizarSaidaReal(viagemId, {
          horarioRealSaida: proximoHorario || null,
          motivoAtraso: proximoMotivo.trim() || null,
        }),
      )
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível salvar a saída real.")
        return
      }
      setAberto(false)
      router.refresh()
    })
  }

  // Calculado a cada tecla: no meio da digitação a data pode estar incompleta — aí só não mostra o atraso ainda.
  const horarioDigitado = tentarConverterEntradaDeDataHora(horario)
  const atrasadoNoRascunho = horarioDigitado !== null && saidaAtrasada(minutosDeAtraso(inicioPrevisto, horarioDigitado))

  return (
    <Popover.Root open={aberto} onOpenChange={abrirOuFechar}>
      <Popover.Trigger asChild>
        {horarioRealSaidaInicial ? (
          <button
            type="button"
            className="group flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left hover:bg-muted"
            aria-label="Editar saída real"
          >
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                {formatarHoraLocal(horarioRealSaidaInicial)}
              </span>
              {saidaAtrasada(minutosAtraso) ? (
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-warning">
                  {formatarAtraso(minutosAtraso)}
                </span>
              ) : (
                minutosAtraso > 0 && (
                  <span
                    className="text-[10px] tabular-nums text-muted-foreground"
                    title={`No horário — até ${TOLERANCIA_SAIDA_MINUTOS} min de tolerância`}
                  >
                    {formatarAtraso(minutosAtraso)}
                  </span>
                )
              )}
            </span>
            {motivoAtrasoInicial && (
              <span className="flex w-full min-w-0 items-center gap-1 text-[11px] text-muted-foreground" title={motivoAtrasoInicial}>
                <MessageSquare aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{motivoAtrasoInicial}</span>
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-3.5" />
              Registrar saída
            </span>
            {motivoAtrasoInicial && (
              <span className="flex w-full min-w-0 items-center gap-1 text-[11px]" title={motivoAtrasoInicial}>
                <MessageSquare aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{motivoAtrasoInicial}</span>
              </span>
            )}
          </button>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-72 space-y-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
        >
          <form
            className="space-y-3"
            onSubmit={(evento) => {
              evento.preventDefault()
              salvar(horario, motivo)
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor={`saida-${viagemId}`} className="text-xs font-medium text-foreground">
                  Saída real
                </label>
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:underline"
                  onClick={() => setHorario(formatDateTimeForInput(new Date()))}
                >
                  Agora
                </button>
              </div>
              <Input
                id={`saida-${viagemId}`}
                type="datetime-local"
                className="h-8 text-xs tabular-nums"
                value={horario}
                disabled={isPending}
                onChange={(evento) => setHorario(evento.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`obs-${viagemId}`} className="text-xs font-medium text-foreground">
                {atrasadoNoRascunho ? "Motivo do atraso" : "Observação"}
              </label>
              <Input
                id={`obs-${viagemId}`}
                className={cn("h-8 text-xs", atrasadoNoRascunho && !motivo && "border-warning/40")}
                placeholder={atrasadoNoRascunho ? "Ex: troca de frota" : "Opcional"}
                maxLength={200}
                list="motivos-atraso"
                value={motivo}
                disabled={isPending}
                onChange={(evento) => setMotivo(evento.target.value)}
              />
              {/* Mesma lista do motorista no celular — escolher dela deixa o relatório de pontualidade agrupado. */}
              <datalist id="motivos-atraso">
                {MOTIVOS_ATRASO.map((opcao) => (
                  <option key={opcao} value={opcao} />
                ))}
              </datalist>
            </div>
            {erro ? <p className="text-[11px] text-destructive">{erro}</p> : null}
            <div className="flex items-center justify-between gap-2">
              {salvoHorario || salvoMotivo ? (
                <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => salvar("", "")}>
                  Limpar
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
