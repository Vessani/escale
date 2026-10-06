import { MapPinned, Receipt, Smartphone, Wrench } from "lucide-react"
import type { StatusViagem, TipoProduto } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EntregaDoPainel } from "@/components/viagem/chegadas-clientes"
import { ChegadasEditaveis, CorrigirKm, DespesasEditaveis } from "@/components/viagem/correcao-registro"
import { totaisDespesas } from "@/lib/services/despesas-viagem"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

type Despesa = { id: number; tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number; registradoEm: Date }

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

function Bloco({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Receipt; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icone className="size-4 text-muted-foreground" aria-hidden /> {titulo}
      </h3>
      {children}
    </section>
  )
}

/**
 * O que o motorista registrou pelo celular nesta viagem (km, chegadas,
 * despesas e problema mecânico). Depois que a viagem sai, o escalador pode
 * corrigir tudo aqui — inclusive com ela já encerrada (fica no histórico).
 */
export function RegistroMotoristaCard({
  viagemId,
  status,
  produto,
  kmInicial,
  kmFinal,
  despesas,
  entregas,
  problemaMecanico,
  problemaMecanicoEm,
}: {
  viagemId: number
  status: StatusViagem
  produto: TipoProduto | null
  kmInicial: number | null
  kmFinal: number | null
  despesas: Despesa[]
  /** Só os clientes (SAP code + número white), com a chegada de cada um. */
  entregas: EntregaDoPainel[]
  problemaMecanico: string | null
  problemaMecanicoEm: Date | null
}) {
  const encerrada = status === "FINALIZADA"
  const podeCorrigir = encerrada || STATUS_EM_ANDAMENTO.includes(status)
  const temRegistro = kmInicial !== null || kmFinal !== null || despesas.length > 0 || entregas.some((e) => e.chegada) || !!problemaMecanico
  if (!podeCorrigir && !temRegistro) return null

  const totais = totaisDespesas(despesas)
  const semCorrecao = status === "CANCELADA" ? "Viagem cancelada: os registros não são corrigidos." : "A viagem ainda não saiu."

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Smartphone className="size-5" aria-hidden /> Registro do motorista
        </CardTitle>
        <CardDescription>
          Lançado pelo motorista no acesso dele.{podeCorrigir && " Se ele errou, corrija aqui — a correção fica no histórico."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {problemaMecanico && (
          <Alert variant="error">
            <span className="flex items-center gap-1.5 font-medium">
              <Wrench className="size-4" aria-hidden /> Problema mecânico
            </span>
            {problemaMecanico}
            {problemaMecanicoEm && (
              <span className="block text-xs opacity-80">Informado em {formatarDataHoraPtBr(problemaMecanicoEm)}</span>
            )}
          </Alert>
        )}

        <div className="space-y-2">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Numero rotulo="Km inicial" valor={kmInicial?.toLocaleString("pt-BR") ?? "—"} />
            <Numero rotulo="Km final" valor={kmFinal?.toLocaleString("pt-BR") ?? "—"} />
            <Numero
              rotulo="Rodou"
              valor={kmInicial !== null && kmFinal !== null ? `${(kmFinal - kmInicial).toLocaleString("pt-BR")} km` : "—"}
            />
            <Numero rotulo="Pedágio" valor={formatarReais(totais.pedagioCentavos)} />
            <Numero rotulo="Pernoite" valor={formatarReais(totais.pernoiteCentavos)} />
          </dl>
          {podeCorrigir && (
            <CorrigirKm key={`${kmInicial}-${kmFinal}`} viagemId={viagemId} kmInicial={kmInicial} kmFinal={kmFinal} encerrada={encerrada} />
          )}
        </div>

        <Bloco titulo="Chegada nos clientes" icone={MapPinned}>
          {podeCorrigir ? (
            <ChegadasEditaveis entregas={entregas} produto={produto} kmInicial={kmInicial} agoraServidor={new Date().toISOString()} />
          ) : (
            <p className="text-sm text-muted-foreground">{semCorrecao}</p>
          )}
        </Bloco>

        <Bloco titulo="Pedágio e pernoite" icone={Receipt}>
          {podeCorrigir ? (
            <DespesasEditaveis
              viagemId={viagemId}
              despesas={despesas.map((despesa) => ({ ...despesa, registradoEm: despesa.registradoEm.toISOString() }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{semCorrecao}</p>
          )}
        </Bloco>
      </CardContent>
    </Card>
  )
}
