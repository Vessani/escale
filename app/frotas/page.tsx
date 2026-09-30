import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck } from "lucide-react"
import { buscarFrotas } from "@/lib/queries/frotas"
import { calcularStatusFrota } from "@/lib/services/frota-regras"
import { formatarProduto } from "@/lib/services/produto.service"
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
  const status = calcularStatusFrota(frota.emManutencao, frota.disponivelEm, agora)

  if (status === "DISPONIVEL") {
    return <Badge variant="success">Disponível</Badge>
  }

  if (status === "EM_VIAGEM") {
    return <Badge variant="info" className="tabular-nums">Em viagem até {formatarDataHoraPtBr(frota.disponivelEm as Date)}</Badge>
  }

  return <Badge variant="warning">Em manutenção</Badge>
}

function AcoesFrota({ frota, podeExcluir }: { frota: Frota; podeExcluir: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/frotas/editar/${frota.id}`}>
        <Button variant="outline" size="sm">Editar</Button>
      </Link>
      {podeExcluir && <ExcluirFrotaButton frotaId={frota.id} cavalo={frota.cavalo} carreta={frota.carreta} />}
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver FrotasCards). */
function FrotasTabela({ frotas, agora, podeExcluir }: { frotas: Frota[]; agora: Date; podeExcluir: boolean }) {
  return (
    <div className="hidden rounded-lg border bg-card shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="font-semibold text-foreground/80">Cavalo</TableHead>
            <TableHead className="font-semibold text-foreground/80">Carreta</TableHead>
            <TableHead className="font-semibold text-foreground/80">Produto</TableHead>
            <TableHead className="font-semibold text-foreground/80">Status</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {frotas.map((frota) => (
            <TableRow key={frota.id} className="hover:bg-muted/50">
              <TableCell className="font-mono font-medium tabular-nums">{frota.cavalo}</TableCell>
              <TableCell className="font-mono tabular-nums">{frota.carreta}</TableCell>
              <TableCell className="text-muted-foreground">{formatarProduto(frota.tipoProduto)}</TableCell>
              <TableCell>
                <StatusFrotaBadge frota={frota} agora={agora} />
              </TableCell>
              <TableCell className="text-right">
                <AcoesFrota frota={frota} podeExcluir={podeExcluir} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver FrotasTabela). */
function FrotasCards({ frotas, agora, podeExcluir }: { frotas: Frota[]; agora: Date; podeExcluir: boolean }) {
  return (
    <div className="space-y-3 md:hidden">
      {frotas.map((frota) => (
        <div key={frota.id} className="space-y-3 rounded-lg border bg-card shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono font-semibold tabular-nums text-foreground">{frota.cavalo} / {frota.carreta}</p>
              <p className="text-xs text-muted-foreground">{formatarProduto(frota.tipoProduto)}</p>
            </div>
            <StatusFrotaBadge frota={frota} agora={agora} />
          </div>
          <AcoesFrota frota={frota} podeExcluir={podeExcluir} />
        </div>
      ))}
    </div>
  )
}

export default async function FrotasPage() {
  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!
  const podeExcluir = session?.user?.role === "ADMIN"
  const frotas = await buscarFrotas(filialId)
  const agora = new Date()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Frotas</h1>
          <p className="text-muted-foreground mt-1">
            Cadastro dos conjuntos (cavalo/carreta) e a disponibilidade de cada um.
          </p>
        </div>
        <Link href="/frotas/novo">
          <Button>
            <PlusCircle className="w-5 h-5 mr-2" />
            Novo Conjunto
          </Button>
        </Link>
      </div>

      {frotas.length === 0 ? (
        <div className="border rounded-lg bg-card shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Truck className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p>Nenhum conjunto cadastrado ainda.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Todos os conjuntos</h2>
            <Badge variant="outline">{frotas.length}</Badge>
          </div>
          <FrotasTabela frotas={frotas} agora={agora} podeExcluir={podeExcluir} />
          <FrotasCards frotas={frotas} agora={agora} podeExcluir={podeExcluir} />
        </section>
      )}
    </div>
  )
}
