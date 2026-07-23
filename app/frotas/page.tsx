import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck } from "lucide-react"
import { buscarFrotas } from "@/lib/queries/frotas"
import { calcularStatusFrota } from "@/lib/services/frota-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import ExcluirFrotaButton from "./excluir-frota-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Frota = Awaited<ReturnType<typeof buscarFrotas>>[number]

function StatusFrotaBadge({ frota, agora }: { frota: Frota; agora: Date }) {
  const status = calcularStatusFrota(frota.disponivelEm, agora)

  if (status === "DISPONIVEL") {
    return <Badge variant="success">Disponível</Badge>
  }

  return <Badge variant="warning">Em manutenção até {formatarDataHoraPtBr(frota.disponivelEm as Date)}</Badge>
}

function AcoesFrota({ frota }: { frota: Frota }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/frotas/editar/${frota.id}`}>
        <Button variant="outline" size="sm">Editar</Button>
      </Link>
      <ExcluirFrotaButton frotaId={frota.id} cavalo={frota.cavalo} carreta={frota.carreta} />
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver FrotasCards). */
function FrotasTabela({ frotas, agora }: { frotas: Frota[]; agora: Date }) {
  return (
    <div className="hidden rounded-lg border bg-white shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Cavalo</TableHead>
            <TableHead className="font-semibold text-slate-700">Carreta</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {frotas.map((frota) => (
            <TableRow key={frota.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{frota.cavalo}</TableCell>
              <TableCell>{frota.carreta}</TableCell>
              <TableCell>
                <StatusFrotaBadge frota={frota} agora={agora} />
              </TableCell>
              <TableCell className="text-right">
                <AcoesFrota frota={frota} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver FrotasTabela). */
function FrotasCards({ frotas, agora }: { frotas: Frota[]; agora: Date }) {
  return (
    <div className="space-y-3 md:hidden">
      {frotas.map((frota) => (
        <div key={frota.id} className="space-y-3 rounded-lg border bg-white shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{frota.cavalo} / {frota.carreta}</p>
            </div>
            <StatusFrotaBadge frota={frota} agora={agora} />
          </div>
          <AcoesFrota frota={frota} />
        </div>
      ))}
    </div>
  )
}

export default async function FrotasPage() {
  const frotas = await buscarFrotas()
  const agora = new Date()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frotas</h1>
          <p className="text-slate-500 mt-1">
            Cadastro dos conjuntos (cavalo/carreta) e a disponibilidade de cada um.
          </p>
        </div>
        <Link href="/frotas/novo">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <PlusCircle className="w-5 h-5 mr-2" />
            Novo Conjunto
          </Button>
        </Link>
      </div>

      {frotas.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Truck className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhum conjunto cadastrado ainda.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Todos os conjuntos</h2>
            <Badge variant="outline">{frotas.length}</Badge>
          </div>
          <FrotasTabela frotas={frotas} agora={agora} />
          <FrotasCards frotas={frotas} agora={agora} />
        </section>
      )}
    </div>
  )
}
