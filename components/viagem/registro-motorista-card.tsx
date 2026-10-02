import { BedDouble, Smartphone, Ticket } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

/** O que o motorista registrou pelo celular nesta viagem (km e despesas) — só leitura pro despacho. */
export function RegistroMotoristaCard({ kmInicial, kmFinal, despesas }: { kmInicial: number | null; kmFinal: number | null; despesas: Despesa[] }) {
  if (kmInicial === null && kmFinal === null && despesas.length === 0) return null
  const soma = (tipo: Despesa["tipo"]) => despesas.filter((d) => d.tipo === tipo).reduce((total, d) => total + d.valorCentavos, 0)

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Smartphone className="size-5" aria-hidden /> Registro do motorista
        </CardTitle>
        <CardDescription>Lançado pelo motorista no acesso dele.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Numero rotulo="Km inicial" valor={kmInicial?.toString() ?? "—"} />
          <Numero rotulo="Km final" valor={kmFinal?.toString() ?? "—"} />
          <Numero rotulo="Rodou" valor={kmInicial !== null && kmFinal !== null ? `${kmFinal - kmInicial} km` : "—"} />
          <Numero rotulo="Pedágio" valor={formatarReais(soma("PEDAGIO"))} />
          <Numero rotulo="Pernoite" valor={formatarReais(soma("PERNOITE"))} />
        </dl>
        {despesas.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {despesas.map((despesa) => (
              <li key={despesa.id} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-2">
                  {despesa.tipo === "PEDAGIO" ? <Ticket className="size-4 text-muted-foreground" aria-hidden /> : <BedDouble className="size-4 text-muted-foreground" aria-hidden />}
                  {despesa.tipo === "PEDAGIO" ? "Pedágio" : "Pernoite"}
                  <span className="text-xs text-muted-foreground">{formatarDataHoraPtBr(despesa.registradoEm)}</span>
                </span>
                <span className="font-medium tabular-nums">{formatarReais(despesa.valorCentavos)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
