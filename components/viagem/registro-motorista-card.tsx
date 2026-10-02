import { BedDouble, Smartphone, Ticket, Wrench } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatarNumero } from "@/lib/services/descarga"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

type Despesa = { id: number; tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number; registradoEm: Date }
type Chegada = {
  id: number
  cliente: string
  cidade: string
  uf: string
  km: number
  chegadaEm: Date
  medicao: "MANOMETRO" | "BALANCA" | null
  nivelInicial: number
  nivelFinal: number
  polInicial: number | null
  polFinal: number | null
  fator: number | null
  totalDescarregado: number
}

function textoMedicao(chegada: Chegada) {
  if (chegada.medicao === "MANOMETRO") return `Manômetro × ${formatarNumero(chegada.fator ?? 0, 4)}`
  if (chegada.medicao === "BALANCA") return chegada.fator === 1 ? "Balança (kg)" : `Balança × ${formatarNumero(chegada.fator ?? 0, 4)}`
  return "Biometano"
}

function unidadeTotal(chegada: Chegada) {
  if (chegada.medicao === "MANOMETRO") return ""
  return chegada.medicao === "BALANCA" && chegada.fator === 1 ? " kg" : " m³"
}

function leituras(chegada: Chegada) {
  const base = `${formatarNumero(chegada.nivelInicial)} → ${formatarNumero(chegada.nivelFinal)}`
  return chegada.polInicial !== null && chegada.polFinal !== null
    ? `${base} m³ (${formatarNumero(chegada.polInicial, 2)} → ${formatarNumero(chegada.polFinal, 2)} pol)`
    : base
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

/** O que o motorista registrou pelo celular nesta viagem (km e despesas) — só leitura pro despacho. */
export function RegistroMotoristaCard({
  kmInicial,
  kmFinal,
  despesas,
  chegadas,
  problemaMecanico,
  problemaMecanicoEm,
}: {
  kmInicial: number | null
  kmFinal: number | null
  despesas: Despesa[]
  chegadas: Chegada[]
  problemaMecanico: string | null
  problemaMecanicoEm: Date | null
}) {
  if (kmInicial === null && kmFinal === null && despesas.length === 0 && chegadas.length === 0 && !problemaMecanico) return null
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
        {problemaMecanico && (
          <Alert variant="error">
            <span className="flex items-center gap-1.5 font-medium"><Wrench className="size-4" aria-hidden /> Problema mecânico</span>
            {problemaMecanico}
            {problemaMecanicoEm && <span className="block text-xs opacity-80">Informado em {formatarDataHoraPtBr(problemaMecanicoEm)}</span>}
          </Alert>
        )}
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Numero rotulo="Km inicial" valor={kmInicial?.toString() ?? "—"} />
          <Numero rotulo="Km final" valor={kmFinal?.toString() ?? "—"} />
          <Numero rotulo="Rodou" valor={kmInicial !== null && kmFinal !== null ? `${kmFinal - kmInicial} km` : "—"} />
          <Numero rotulo="Pedágio" valor={formatarReais(soma("PEDAGIO"))} />
          <Numero rotulo="Pernoite" valor={formatarReais(soma("PERNOITE"))} />
        </dl>
        {chegadas.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead>Medição</TableHead>
                  <TableHead className="text-right">Nível inicial → final</TableHead>
                  <TableHead className="text-right">Descarregado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chegadas.map((chegada) => (
                  <TableRow key={chegada.id}>
                    <TableCell>
                      <span className="font-medium">{chegada.cliente}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatarNomeProprio(chegada.cidade)}/{chegada.uf}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatarDataHoraPtBr(chegada.chegadaEm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{chegada.km.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{textoMedicao(chegada)}</TableCell>
                    <TableCell className="text-right tabular-nums">{leituras(chegada)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatarNumero(chegada.totalDescarregado)}{unidadeTotal(chegada)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
