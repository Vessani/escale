import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarMinhaViagem } from "@/lib/services/minhas-viagens.service"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { quando } from "../formato"
import { PainelViagemMotorista, type ViagemDoPainel } from "./painel-viagem-motorista"

export const metadata = { title: "Viagem" }

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

export default async function MinhaViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const id = Number((await params).id)
  const viagem = Number.isInteger(id) && id > 0 ? await buscarMinhaViagem(filialId, motoristaId, id) : null
  if (!viagem) notFound()

  const agora = new Date()
  const souPrincipal = viagem.motoristaId === motoristaId
  const dadosPainel: ViagemDoPainel = {
    id: viagem.id,
    numViagem: viagem.numViagem,
    status: viagem.status,
    inicioPrevisto: viagem.inicioPrevisto.toISOString(),
    horarioRealSaida: viagem.horarioRealSaida?.toISOString() ?? null,
    motivoAtraso: viagem.motivoAtraso,
    kmInicial: viagem.kmInicial,
    kmFinal: viagem.kmFinal,
    despesas: viagem.despesas.map((despesa) => ({
      id: despesa.id,
      tipo: despesa.tipo,
      valorCentavos: despesa.valorCentavos,
      registradoEm: despesa.registradoEm.toISOString(),
      minha: despesa.usuarioId === session.user.id,
    })),
  }

  return (
    <>
      <Link href="/minhas-viagens" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Minhas viagens
      </Link>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{viagem.numViagem}</h1>
          <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
            {formatarStatusViagem(viagem.status)}
          </Badge>
        </div>
        <dl className="mt-2 divide-y">
          <Linha rotulo="Saída prevista">{quando(viagem.inicioPrevisto, agora)}</Linha>
          <Linha rotulo="Fim previsto">{quando(viagem.fimPrevisto, agora)}</Linha>
          <Linha rotulo="Frota">
            <span className="font-mono">
              {formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}
            </span>
          </Linha>
          {viagem.produto && <Linha rotulo="Produto">{formatarProduto(viagem.produto)}</Linha>}
          {souPrincipal
            ? viagem.motoristaAcompanhante && <Linha rotulo="Acompanhante">{formatarNomeProprio(viagem.motoristaAcompanhante.nome)}</Linha>
            : viagem.motorista && <Linha rotulo="Motorista">{formatarNomeProprio(viagem.motorista.nome)}</Linha>}
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Entregas ({viagem.entregas.length})</h2>
        <ol className="mt-2 divide-y">
          {viagem.entregas.map((entrega, indice) => (
            <li key={entrega.id} className="flex gap-3 py-2 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{indice + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium">{entrega.cliente}</span>
                <span className="text-muted-foreground">
                  {entrega.cidade}/{entrega.uf} · {quando(entrega.dataEntrega, agora)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <PainelViagemMotorista viagem={dadosPainel} souPrincipal={souPrincipal} agoraServidor={agora.toISOString()} />
    </>
  )
}
