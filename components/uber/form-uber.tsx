"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Check, CheckCircle2 } from "lucide-react"
import type { MotivoUber } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pedirMeuUber, solicitarUber } from "@/lib/actions/uber"
import { chamarAcao } from "@/lib/chamar-acao"
import type { LinkGerado } from "@/lib/services/link-aprovacao"
import { MOTIVOS_UBER, TAMANHO_MAXIMO_LOCAL_UBER, formatarMotivoUber } from "@/lib/services/uber-regras"
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

/**
 * Pedido de Uber — mesmo formato do pedido de estouro (FormEstouro).
 * `modo="motorista"`: o pedido é do próprio motorista (viagens já vêm só as
 * dele, campos grandes pro celular); `modo="escalador"`: escolhe o
 * motorista. Nos dois, depois de registrar, mostra o botão de enviar no
 * grupo de WhatsApp da filial.
 */
export function FormUber({
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
  const [origem, setOrigem] = useState("")
  const [destino, setDestino] = useState("")
  const [motivo, setMotivo] = useState<MotivoUber | null>(null)

  const grande = modo === "motorista"
  const campo = cn("rounded-md border border-input bg-background px-2 text-foreground", grande ? "h-11 text-base" : "h-9 text-sm")
  const rotulo = "grid gap-1 text-xs font-medium text-muted-foreground"

  const viagensDisponiveis = useMemo(() => {
    if (modo === "motorista") return viagens
    const id = Number(motoristaId)
    return id ? viagens.filter((v) => v.motoristaId === id || v.motoristaAcompanhanteId === id) : []
  }, [modo, motoristaId, viagens])

  const completo = (modo === "motorista" || motoristaId) && origem.trim().length >= 3 && destino.trim().length >= 3 && motivo
  const nomeMotorista = motoristas.find((m) => String(m.id) === motoristaId)?.nome

  const enviar = () => {
    if (!motivo) return
    setErro("")
    const dados = { viagemId: viagemId ? Number(viagemId) : null, origem, destino, motivo }
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() =>
        modo === "motorista" ? pedirMeuUber(dados) : solicitarUber({ ...dados, motoristaId: Number(motoristaId) }),
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
          {motivo && formatarMotivoUber(motivo)}: {origem.trim()} → {destino.trim()}. Agora envie no grupo — a resposta do gestor aparece na
          lista.
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

      <div className={cn("grid gap-3", !grande && "sm:grid-cols-2")}>
        <label className={rotulo}>
          Origem
          <input
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            maxLength={TAMANHO_MAXIMO_LOCAL_UBER}
            placeholder="Ex: Posto Graal, km 120 da BR-101"
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Destino
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            maxLength={TAMANHO_MAXIMO_LOCAL_UBER}
            placeholder="Ex: Hotel Ibis, Joinville"
            className={campo}
          />
        </label>
      </div>

      <div className={rotulo}>
        Motivo
        {/* Mesma grade dos motivos do estouro, mas escolhe um só. */}
        <div role="group" aria-label="Motivo" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1">
          {MOTIVOS_UBER.map((opcao) => {
            const marcado = motivo === opcao.valor
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={marcado}
                onClick={() => setMotivo(opcao.valor)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 text-left text-sm transition-colors",
                  grande ? "py-2.5" : "py-1.5",
                  marcado
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Check className={cn("size-4 shrink-0 text-primary", !marcado && "invisible")} aria-hidden />
                {opcao.rotulo}
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
