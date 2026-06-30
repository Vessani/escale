import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck } from "lucide-react"
import { buscarViagens } from "@/lib/queries/viagens"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Viagem = Awaited<ReturnType<typeof buscarViagens>>[number]

type GrupoStatus = "AGUARDANDO_INICIO" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA"

const ordemGrupos: GrupoStatus[] = [
  "EM_ANDAMENTO",
  "AGUARDANDO_INICIO",
  "FINALIZADA",
  "CANCELADA",
]

const tituloGrupo: Record<GrupoStatus, string> = {
  AGUARDANDO_INICIO: "Aguardando início",
  EM_ANDAMENTO: "Em andamento",
  FINALIZADA: "Finalizadas",
  CANCELADA: "Canceladas",
}

function formatarData(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data)
}

function resolverGrupoStatus(viagem: Viagem, agora: Date): GrupoStatus {
  if (viagem.status === "CANCELADA") {
    return "CANCELADA"
  }

  if (viagem.status === "FINALIZADA" || viagem.fimPrevisto <= agora) {
    return "FINALIZADA"
  }

  if (
    viagem.status === "EM_CURSO" ||
    (viagem.inicioPrevisto <= agora && viagem.fimPrevisto > agora)
  ) {
    return "EM_ANDAMENTO"
  }

  return "AGUARDANDO_INICIO"
}

function ViagensTabela({ viagens }: { viagens: Viagem[] }) {
  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Nº Viagem</TableHead>
            <TableHead className="font-semibold text-slate-700">Início Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Fim Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Turno</TableHead>
            <TableHead className="font-semibold text-slate-700">Caminhão</TableHead>
            <TableHead className="font-semibold text-slate-700">Motorista</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viagens.map((viagem: Viagem) => (
            <TableRow key={viagem.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{viagem.numViagem}</TableCell>
              <TableCell>{formatarData(viagem.inicioPrevisto)}</TableCell>
              <TableCell>{formatarData(viagem.fimPrevisto)}</TableCell>
              <TableCell>
                <Badge variant={viagem.turno === "MANHA" ? "default" : "secondary"}>{viagem.turno}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <span className="font-medium text-slate-900">{viagem.cavalo}</span>
                  <span className="text-slate-500 ml-1">/ {viagem.carreta}</span>
                </div>
              </TableCell>
              <TableCell>
                {viagem.motorista ? (
                  <span className="text-slate-900 font-medium">{viagem.motorista.nome}</span>
                ) : (
                  <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600">
                    Pendente Alocação
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/viagens/editar/${viagem.id}`}>
                  <Button variant="outline" size="sm">Editar</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function ViagensPage() {
  const viagens = await buscarViagens()
  const agora = new Date()

  const grupos = viagens.reduce<Record<GrupoStatus, Viagem[]>>(
    (acumulado: Record<GrupoStatus, Viagem[]>, viagem: Viagem) => {
      acumulado[resolverGrupoStatus(viagem, agora)].push(viagem)
      return acumulado
    },
    {
      AGUARDANDO_INICIO: [],
      EM_ANDAMENTO: [],
      FINALIZADA: [],
      CANCELADA: [],
    },
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Viagens</h1>
          <p className="text-slate-500 mt-1">Acompanhe viagens em andamento, aguardando início, finalizadas e canceladas.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/viagens/alocacao">
            <Button variant="outline">Alocação Manual</Button>
          </Link>
          <Link href="/viagens/nova">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <PlusCircle className="w-5 h-5 mr-2" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      {viagens.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Truck className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhuma viagem cadastrada ainda.</p>
          </div>
        </div>
      ) : (
        ordemGrupos.map((grupo: GrupoStatus) => (
          <section key={grupo} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{tituloGrupo[grupo]}</h2>
              <Badge variant="outline">{grupos[grupo].length}</Badge>
            </div>

            {grupos[grupo].length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Nenhuma viagem nesta categoria.
              </div>
            ) : (
              <ViagensTabela viagens={grupos[grupo]} />
            )}
          </section>
        ))
      )}
    </div>
  )
}