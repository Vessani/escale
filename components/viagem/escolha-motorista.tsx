"use client"

import { Sparkles } from "lucide-react"
import type { MotoristaCompativel } from "@/lib/types/alocacao"
import { Alert } from "@/components/ui/alert"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { IndicadorCompatibilidade } from "@/components/motorista/indicador-compatibilidade"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

/** Valor do Select pra "deixar sem motorista" (o Radix não aceita valor vazio num item). */
export const SEM_MOTORISTA = "0"

/** "descansado" ou "livre às 11:58" / "livre 02/10 05:40" — relativo ao início da viagem. */
function textoDescanso(motorista: MotoristaCompativel, inicioViagem: Date): { texto: string; ok: boolean } {
  if (!motorista.liberadoEm) return { texto: "sem jornada anterior", ok: true }
  const liberado = new Date(motorista.liberadoEm)
  if (liberado <= inicioViagem) return { texto: "descanso ok", ok: true }
  const mesmoDia = liberado.toDateString() === inicioViagem.toDateString()
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(liberado)
  return { texto: `livre ${mesmoDia ? "às" : dia} ${formatarHoraLocal(liberado)}`, ok: false }
}

function textoDias(dias: number) {
  return dias === 1 ? "1 dia disponível" : `${dias} dias disponíveis`
}

function Detalhe({ motorista, inicioViagem, className }: { motorista: MotoristaCompativel; inicioViagem: Date; className?: string }) {
  const descanso = textoDescanso(motorista, inicioViagem)
  return (
    <span className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {textoDias(motorista.diasDisponiveis)} ·{" "}
      <span className={descanso.ok ? undefined : "font-medium text-warning"}>{descanso.texto}</span>
    </span>
  )
}

function SeloSugerido() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
      <Sparkles className="size-2.5" aria-hidden /> Sugerido
    </span>
  )
}

/**
 * Escolha do motorista de uma viagem (tela de Alocação e revisão do import):
 * o campo fechado mostra quem está escolhido de verdade — nome, ícone do
 * tipo, selo "Sugerido" e a situação de descanso —, e o aviso de descanso
 * embaixo é o DO ESCOLHIDO (troca junto). Antes o nome do sugerido ficava
 * num quadro à parte e o campo só mostrava "6 dias · livre às 11:58", então
 * trocar o motorista parecia não mudar nada.
 */
export function EscolhaMotorista({
  compativeis,
  sugeridoId,
  valor,
  onChange,
  inicioViagem,
  disabled,
  conflitoNoLote,
}: {
  compativeis: MotoristaCompativel[]
  sugeridoId: number | null
  /** id como texto, ou SEM_MOTORISTA. */
  valor: string
  onChange: (valor: string) => void
  inicioViagem: string
  disabled?: boolean
  /** Outras viagens da tela em que esse mesmo motorista foi escolhido sem descanso entre elas. */
  conflitoNoLote?: string[]
}) {
  const inicio = new Date(inicioViagem)
  const escolhido = compativeis.find((motorista) => String(motorista.id) === valor) ?? null
  const sugerido = compativeis.find((motorista) => motorista.id === sugeridoId) ?? null
  const comDescanso = compativeis.filter((motorista) => textoDescanso(motorista, inicio).ok)
  const semDescanso = compativeis.filter((motorista) => !textoDescanso(motorista, inicio).ok)

  const item = (motorista: MotoristaCompativel) => (
    <SelectItem key={motorista.id} value={String(motorista.id)} className="py-2">
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <IndicadorCompatibilidade situacao={textoDescanso(motorista, inicio).ok ? "OK" : "SEM_DESCANSO"} />
          <NomeMotorista nome={motorista.nome} tipo={motorista.tipo} className="font-medium" />
          {motorista.id === sugeridoId && <SeloSugerido />}
        </span>
        <Detalhe motorista={motorista} inicioViagem={inicio} className="pl-4" />
      </span>
    </SelectItem>
  )

  return (
    <div className="space-y-2">
      <Select value={valor} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-auto min-h-11 bg-card py-1.5 text-left">
          <SelectValue placeholder="Escolha o motorista">
            {escolhido ? (
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <NomeMotorista nome={escolhido.nome} tipo={escolhido.tipo} className="font-medium text-foreground" />
                  {escolhido.id === sugeridoId && <SeloSugerido />}
                </span>
                <Detalhe motorista={escolhido} inicioViagem={inicio} />
              </span>
            ) : (
              <span className="text-muted-foreground">Sem motorista — alocar depois</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-96">
          {comDescanso.length > 0 && (
            <SelectGroup>
              <SelectLabel>Descanso ok · {comDescanso.length}</SelectLabel>
              {comDescanso.map(item)}
            </SelectGroup>
          )}
          {comDescanso.length > 0 && semDescanso.length > 0 && <SelectSeparator />}
          {semDescanso.length > 0 && (
            <SelectGroup>
              <SelectLabel>Ainda descansando no horário · {semDescanso.length}</SelectLabel>
              {semDescanso.map(item)}
            </SelectGroup>
          )}
          <SelectSeparator />
          <SelectItem value={SEM_MOTORISTA} className="text-muted-foreground">
            Sem motorista — alocar depois
          </SelectItem>
        </SelectContent>
      </Select>

      {sugerido && escolhido?.id !== sugerido.id && (
        <p className="text-xs text-muted-foreground">
          Sugestão do sistema: <span className="font-medium text-foreground">{formatarNomeProprio(sugerido.nome)}</span>{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(sugerido.id))}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            usar sugestão
          </button>
        </p>
      )}

      {escolhido?.avisoDescanso && <Alert variant="warning">{escolhido.avisoDescanso}</Alert>}
      {conflitoNoLote && conflitoNoLote.length > 0 && (
        <Alert variant="warning">
          {formatarNomeProprio(escolhido?.nome ?? "Esse motorista")} também está escolhido na(s) viagem(ns) {conflitoNoLote.join(", ")}, sem 11h
          de descanso entre elas.
        </Alert>
      )}
    </div>
  )
}
