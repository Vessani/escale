import Link from "next/link"
import { ChevronRight, Clock, MapPin, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { AtualizacaoAutomatica } from "@/components/atualizacao-automatica"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarMinhasViagens, type MinhaViagem } from "@/lib/services/minhas-viagens.service"
import { STATUS_A_INICIAR, STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { quando, rota } from "./formato"

export const metadata = { title: "Minhas viagens" }

function CartaoViagem({ viagem, motoristaId, agora }: { viagem: MinhaViagem; motoristaId: number; agora: Date }) {
  const aIniciar = STATUS_A_INICIAR.includes(viagem.status)
  const atrasada = aIniciar && saidaAtrasada(minutosDeAtraso(viagem.inicioPrevisto, agora))
  const acompanhante = viagem.motoristaId !== motoristaId

  return (
    <Link
      href={`/minhas-viagens/${viagem.id}`}
      className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-semibold">{viagem.numViagem}</span>
            <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
              {formatarStatusViagem(viagem.status)}
            </Badge>
            {acompanhante && <Badge variant="outline">Acompanhante</Badge>}
          </div>
          <p className={`flex items-center gap-1.5 text-sm ${atrasada ? "font-medium text-destructive" : "text-muted-foreground"}`}>
            <Clock className="size-4 shrink-0" aria-hidden />
            Saída {quando(viagem.inicioPrevisto, agora)}
            {atrasada && " · atrasada"}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Truck className="size-4 shrink-0" aria-hidden />
            <span className="font-mono">
              {formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{rota(viagem.entregas)}</span>
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  )
}

export default async function MinhasViagensPage() {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const agora = new Date()
  const viagens = await buscarMinhasViagens(filialId, motoristaId, agora)

  const grupos = [
    { titulo: "Em andamento", itens: viagens.filter((v) => STATUS_EM_ANDAMENTO.includes(v.status)) },
    { titulo: "Próximas", itens: viagens.filter((v) => STATUS_A_INICIAR.includes(v.status)) },
    { titulo: "Encerradas nas últimas 24h", itens: viagens.filter((v) => v.status === "FINALIZADA") },
  ].filter((grupo) => grupo.itens.length > 0)

  return (
    <>
      <AtualizacaoAutomatica segundos={60} />
      <h1 className="text-xl font-semibold tracking-tight">Minhas viagens</h1>
      {grupos.length === 0 ? (
        <EmptyState icone={Truck} titulo="Nenhuma viagem pra você agora" descricao="Quando o escalador alocar uma viagem pra você, ela aparece aqui." />
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.titulo} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo.titulo}</h2>
            {grupo.itens.map((viagem) => (
              <CartaoViagem key={viagem.id} viagem={viagem} motoristaId={motoristaId} agora={agora} />
            ))}
          </section>
        ))
      )}
    </>
  )
}
