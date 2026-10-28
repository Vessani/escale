import Link from "next/link"
import { ArrowLeft, CarTaxiFront } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarViagensAbertasDoMotorista } from "@/lib/services/estouro-jornada.service"
import { buscarSolicitacoesUber } from "@/lib/services/uber.service"
import { formatarMotivoUber } from "@/lib/services/uber-regras"
import { CLASSE_SITUACAO, ROTULO_SITUACAO } from "@/lib/services/link-aprovacao-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { AcoesUber } from "@/components/uber/acoes-uber"
import { FormUber } from "@/components/uber/form-uber"

export const metadata = { title: "Pedir Uber" }

const DIAS_NA_LISTA = 7

/** Motorista pede o Uber e acompanha a resposta do gestor. `?viagem=ID` já vem da tela da viagem. */
export default async function MeuUberPage({ searchParams }: { searchParams: Promise<{ viagem?: string }> }) {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const [viagens, pedidos] = await Promise.all([
    buscarViagensAbertasDoMotorista(filialId, motoristaId),
    buscarSolicitacoesUber(filialId, DIAS_NA_LISTA, { motoristaId }),
  ])
  const viagemInicial = Number((await searchParams).viagem) || undefined

  return (
    <>
      <Link href="/minhas-viagens" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Minhas viagens
      </Link>

      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <CarTaxiFront className="size-5 text-primary" aria-hidden />
          Pedir Uber
        </h1>
        <p className="text-sm text-muted-foreground">
          O link vai pro grupo de WhatsApp da filial e o gestor aprova ou recusa por ele. Só chame o Uber depois de aprovado.
        </p>
        <FormUber modo="motorista" viagens={viagens} viagemInicial={viagemInicial} voltarHref="/minhas-viagens" />
      </section>

      {pedidos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Meus pedidos (últimos {DIAS_NA_LISTA} dias)
          </h2>
          {pedidos.map((p) => (
            <div key={p.id} className="space-y-1.5 rounded-xl border bg-card p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {formatarMotivoUber(p.motivo)}
                  {p.viagem && <span className="ml-2 font-mono font-normal text-muted-foreground">{p.viagem.numViagem}</span>}
                </span>
                <Badge variant="outline" className={CLASSE_SITUACAO[p.situacao]}>
                  {ROTULO_SITUACAO[p.situacao]}
                </Badge>
              </div>
              <p className="text-foreground/80">
                {p.origem} → {p.destino}
              </p>
              <p className="text-muted-foreground">pedido em {formatarDataHoraPtBr(p.criadoEm)}</p>
              {p.decididoEm && (
                <p className="text-muted-foreground">
                  {p.decididoPorNome} em {formatarDataHoraPtBr(p.decididoEm)}
                  {p.observacaoGestor && <span className="block text-foreground/80">“{p.observacaoGestor}”</span>}
                </p>
              )}
              {(p.situacao === "PENDENTE" || p.situacao === "EXPIRADO") && (
                <div className="flex justify-end">
                  <AcoesUber id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} doMotorista />
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  )
}
