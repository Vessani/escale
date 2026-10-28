"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Check, CheckCircle2 } from "lucide-react"
import type { MotivoEstouro } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ControleSegmentado } from "@/components/ui/controle-segmentado"
import { pedirMeuEstouro, solicitarEstouro } from "@/lib/actions/estouro-jornada"
import { chamarAcao } from "@/lib/chamar-acao"
import type { LinkGerado } from "@/lib/services/link-aprovacao"
import {
  LIMITE_MINUTOS_ESTOURO,
  MAXIMO_MOTIVOS_ESTOURO,
  MOTIVOS_ESTOURO,
  OPCOES_MINUTOS_ESTOURO,
  formatarMinutos,
} from "@/lib/services/estouro-jornada-regras"
import { formatarDiaMesHora } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"
import { PainelEnvioWhatsApp } from "@/components/aprovacao/painel-envio-whatsapp"

type Viagem = {
  id: number
  numViagem: string
  inicioPrevisto: Date | string
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
}

const OPCOES_HORAS = OPCOES_MINUTOS_ESTOURO.map((m) => ({ valor: String(m), rotulo: formatarMinutos(m) }))

/**
 * Pedido de estouro de jornada. `modo="motorista"`: o pedido é do próprio
 * motorista (viagens já vêm só as dele, campos grandes pro celular);
 * `modo="escalador"`: escolhe o motorista. Nos dois, depois de registrar,
 * mostra o botão de enviar no grupo de WhatsApp da filial.
 */
export function FormEstouro({
  modo,
  viagens,
  motoristas = [],
  viagemInicial,
  voltarHref,
}: {
  modo: "escalador" | "motorista"
  viagens: Viagem[]
  motoristas?: Array<{ id: number; nome: string }>
  viagemInicial?: number
  voltarHref: string
}) {
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [link, setLink] = useState<LinkGerado | null>(null)

  const [motoristaId, setMotoristaId] = useState("")
  const [viagemId, setViagemId] = useState(viagemInicial && viagens.some((v) => v.id === viagemInicial) ? String(viagemInicial) : "")
  const [minutos, setMinutos] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<MotivoEstouro[]>([])

  const grande = modo === "motorista"
  const campo = cn("rounded-md border border-input bg-background px-2 text-foreground", grande ? "h-11 text-base" : "h-9 text-sm")
  const rotulo = "grid gap-1 text-xs font-medium text-muted-foreground"

  const viagensDisponiveis = useMemo(() => {
    if (modo === "motorista") return viagens
    const id = Number(motoristaId)
    return id ? viagens.filter((v) => v.motoristaId === id || v.motoristaAcompanhanteId === id) : []
  }, [modo, motoristaId, viagens])

  const completo = (modo === "motorista" || motoristaId) && minutos && motivos.length > 0
  const nomeMotorista = motoristas.find((m) => String(m.id) === motoristaId)?.nome

  const alternarMotivo = (motivo: MotivoEstouro) =>
    setMotivos((atuais) =>
      atuais.includes(motivo) ? atuais.filter((m) => m !== motivo) : atuais.length < MAXIMO_MOTIVOS_ESTOURO ? [...atuais, motivo] : atuais,
    )

  const enviar = () => {
    setErro("")
    const dados = { viagemId: viagemId ? Number(viagemId) : null, minutosExtras: Number(minutos), motivos }
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() =>
        modo === "motorista" ? pedirMeuEstouro(dados) : solicitarEstouro({ ...dados, motoristaId: Number(motoristaId) }),
      )
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setLink(resposta.link)
    })
  }

  if (link) {
    return (
      <div className="space-y-3">
        <Alert variant="success">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4" aria-hidden /> Pedido registrado
          </span>
          {nomeMotorista && `${formatarNomeProprio(nomeMotorista)} · `}
          {formatarMinutos(Number(minutos))} extras. Agora envie no grupo — a resposta do gestor aparece na lista.
        </Alert>
        <PainelEnvioWhatsApp link={link} grande={grande} />
        <Button asChild variant="outline" className={cn("w-full", grande && "h-11")}>
          <Link href={voltarHref}>Voltar para a lista</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {erro && <Alert variant="error">{erro}</Alert>}

      <div className={cn("grid gap-3", !grande && "sm:grid-cols-2")}>
        {modo === "escalador" && (
          <label className={rotulo}>
            Motorista
            <select
              value={motoristaId}
              onChange={(e) => {
                setMotoristaId(e.target.value)
                setViagemId("")
              }}
              className={campo}
            >
              <option value="">Escolha o motorista</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatarNomeProprio(m.nome)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={rotulo}>
          Viagem (opcional)
          <select
            value={viagemId}
            onChange={(e) => setViagemId(e.target.value)}
            disabled={(modo === "escalador" && !motoristaId) || viagensDisponiveis.length === 0}
            className={cn(campo, "disabled:opacity-60")}
          >
            <option value="">
              {(modo === "motorista" || motoristaId) && viagensDisponiveis.length === 0 ? "Nenhuma viagem aberta" : "Sem viagem vinculada"}
            </option>
            {viagensDisponiveis.map((v) => (
              <option key={v.id} value={v.id}>
                {v.numViagem} — {formatarDiaMesHora(v.inicioPrevisto)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={rotulo}>
        Horas extras (até {formatarMinutos(LIMITE_MINUTOS_ESTOURO)})
        <ControleSegmentado rotulo="Horas extras" opcoes={OPCOES_HORAS} valor={minutos} onChange={setMinutos} largo />
      </div>

      <div className={rotulo}>
        <span className="flex justify-between">
          <span>Motivos (até {MAXIMO_MOTIVOS_ESTOURO})</span>
          <span className="tabular-nums">
            {motivos.length}/{MAXIMO_MOTIVOS_ESTOURO}
          </span>
        </span>
        <div role="group" aria-label="Motivos" className="grid gap-1 rounded-lg border bg-muted/40 p-1 sm:grid-cols-2">
          {MOTIVOS_ESTOURO.map((motivo) => {
            const marcado = motivos.includes(motivo.valor)
            const bloqueado = !marcado && motivos.length >= MAXIMO_MOTIVOS_ESTOURO
            return (
              <button
                key={motivo.valor}
                type="button"
                aria-pressed={marcado}
                disabled={bloqueado}
                onClick={() => alternarMotivo(motivo.valor)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 text-left text-sm transition-colors disabled:opacity-50",
                  grande ? "py-2.5" : "py-1.5",
                  marcado
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Check className={cn("size-4 shrink-0 text-primary", !marcado && "invisible")} aria-hidden />
                {motivo.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="ghost" className={grande ? "h-12" : undefined}>
          <Link href={voltarHref}>Cancelar</Link>
        </Button>
        <Button type="button" className={cn("flex-1", grande && "h-12 text-base")} disabled={pendente || !completo} onClick={enviar}>
          {pendente ? "Registrando..." : "Registrar e gerar link"}
        </Button>
      </div>
    </div>
  )
}
