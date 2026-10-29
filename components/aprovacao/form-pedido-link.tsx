"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { Check, CheckCircle2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { chamarAcao } from "@/lib/chamar-acao"
import type { LinkGerado, RespostaLink } from "@/lib/services/link-aprovacao"
import { formatarDiaMesHora } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"
import { PainelEnvioWhatsApp } from "@/components/aprovacao/painel-envio-whatsapp"

/**
 * Peças comuns dos formulários de pedido por link (FormEstouro, FormUber):
 * escolha de motorista e viagem, envio, tela de "Pedido registrado" com o
 * botão do WhatsApp e o rodapé Cancelar / Registrar. Cada formulário só
 * monta os campos dele (horas e motivos do estouro; origem, destino e
 * motivo do Uber).
 *
 * `modo="motorista"`: o pedido é do próprio motorista (viagens já vêm só as
 * dele, campos grandes pro celular); `modo="escalador"`: escolhe o motorista.
 */

export type ModoPedido = "escalador" | "motorista"

export type ViagemDoPedido = {
  id: number
  numViagem: string
  inicioPrevisto: Date | string
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
}

type MotoristaDoPedido = { id: number; nome: string }

/** Quem e qual viagem vão no pedido, pra action. `motoristaId` é null no modo motorista (vem da sessão). */
type Destinatario = { motoristaId: number | null; viagemId: number | null }

export function usePedidoLink({
  modo,
  viagens,
  motoristas,
  viagemInicial,
}: {
  modo: ModoPedido
  viagens: ViagemDoPedido[]
  motoristas: MotoristaDoPedido[]
  viagemInicial?: number
}) {
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [link, setLink] = useState<LinkGerado | null>(null)

  const [motoristaId, setMotoristaId] = useState("")
  const [viagemId, setViagemId] = useState(viagemInicial && viagens.some((v) => v.id === viagemInicial) ? String(viagemInicial) : "")

  const grande = modo === "motorista"

  const viagensDisponiveis = useMemo(() => {
    if (modo === "motorista") return viagens
    const id = Number(motoristaId)
    return id ? viagens.filter((v) => v.motoristaId === id || v.motoristaAcompanhanteId === id) : []
  }, [modo, motoristaId, viagens])

  const escolherMotorista = (id: string) => {
    setMotoristaId(id)
    setViagemId("")
  }

  const enviar = (acao: (destinatario: Destinatario) => Promise<RespostaLink>) => {
    setErro("")
    const destinatario: Destinatario = {
      motoristaId: modo === "escalador" ? Number(motoristaId) : null,
      viagemId: viagemId ? Number(viagemId) : null,
    }
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => acao(destinatario))
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setLink(resposta.link)
    })
  }

  return {
    modo,
    grande,
    pendente,
    erro,
    link,
    motoristaId,
    escolherMotorista,
    viagemId,
    setViagemId,
    viagensDisponiveis,
    enviar,
    /** Já dá pra enviar quanto a quem pede: no modo escalador, precisa ter escolhido o motorista. */
    temMotorista: modo === "motorista" || motoristaId !== "",
    nomeMotorista: motoristas.find((m) => String(m.id) === motoristaId)?.nome,
    classes: {
      campo: cn("rounded-md border border-input bg-background px-2 text-foreground", grande ? "h-11 text-base" : "h-9 text-sm"),
      rotulo: "grid gap-1 text-xs font-medium text-muted-foreground",
      linha: cn("grid gap-3", !grande && "sm:grid-cols-2"),
    },
  }
}

type Pedido = ReturnType<typeof usePedidoLink>

/** Seletor de motorista (só no modo escalador) e de viagem (opcional). */
export function CamposMotoristaViagem({ pedido, motoristas }: { pedido: Pedido; motoristas: MotoristaDoPedido[] }) {
  const { modo, motoristaId, viagemId, viagensDisponiveis, classes } = pedido
  return (
    <div className={classes.linha}>
      {modo === "escalador" && (
        <label className={classes.rotulo}>
          Motorista
          <select value={motoristaId} onChange={(e) => pedido.escolherMotorista(e.target.value)} className={classes.campo}>
            <option value="">Escolha o motorista</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {formatarNomeProprio(m.nome)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={classes.rotulo}>
        Viagem (opcional)
        <select
          value={viagemId}
          onChange={(e) => pedido.setViagemId(e.target.value)}
          disabled={!pedido.temMotorista || viagensDisponiveis.length === 0}
          className={cn(classes.campo, "disabled:opacity-60")}
        >
          <option value="">
            {pedido.temMotorista && viagensDisponiveis.length === 0 ? "Nenhuma viagem aberta" : "Sem viagem vinculada"}
          </option>
          {viagensDisponiveis.map((v) => (
            <option key={v.id} value={v.id}>
              {v.numViagem} — {formatarDiaMesHora(v.inicioPrevisto)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** Depois de registrar: confirmação, botão de enviar no grupo e volta pra lista. `resumo`: o que foi pedido. */
export function PedidoRegistrado({
  pedido,
  link,
  voltarHref,
  resumo,
}: {
  pedido: Pedido
  link: LinkGerado
  voltarHref: string
  resumo: ReactNode
}) {
  return (
    <div className="space-y-3">
      <Alert variant="success">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="size-4" aria-hidden /> Pedido registrado
        </span>
        {pedido.nomeMotorista && `${formatarNomeProprio(pedido.nomeMotorista)} · `}
        {resumo} Agora envie no grupo — a resposta do gestor aparece na lista.
      </Alert>
      <PainelEnvioWhatsApp link={link} grande={pedido.grande} />
      <Button asChild variant="outline" className={cn("w-full", pedido.grande && "h-11")}>
        <Link href={voltarHref}>Voltar para a lista</Link>
      </Button>
    </div>
  )
}

/** Botão de uma opção da grade de motivos (marca/desmarca). */
export function OpcaoMarcavel({
  marcado,
  bloqueado = false,
  grande,
  onClick,
  children,
}: {
  marcado: boolean
  bloqueado?: boolean
  grande: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={marcado}
      disabled={bloqueado}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 text-left text-sm transition-colors disabled:opacity-50",
        grande ? "py-2.5" : "py-1.5",
        marcado ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Check className={cn("size-4 shrink-0 text-primary", !marcado && "invisible")} aria-hidden />
      {children}
    </button>
  )
}

/** Cancelar / Registrar e gerar link. */
export function RodapePedido({
  pedido,
  voltarHref,
  completo,
  onEnviar,
}: {
  pedido: Pedido
  voltarHref: string
  completo: boolean
  onEnviar: () => void
}) {
  const { grande, pendente } = pedido
  return (
    <div className="flex gap-2">
      <Button asChild variant="ghost" className={grande ? "h-12" : undefined}>
        <Link href={voltarHref}>Cancelar</Link>
      </Button>
      <Button type="button" className={cn("flex-1", grande && "h-12 text-base")} disabled={pendente || !completo} onClick={onEnviar}>
        {pendente ? "Registrando..." : "Registrar e gerar link"}
      </Button>
    </div>
  )
}
