import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, PlusCircle, Truck } from "lucide-react"
import { buscarViagens } from "@/lib/queries/viagens"
import { STATUS_VIAGEM_OPCOES, ehStatusViagem, formatarStatusViagem } from "@/lib/services/viagem-status.service"
import AtualizarStatusRapido from "./atualizar-status-rapido"
import { classeBadgeStatusViagem, classeBadgeTurno } from "./badge-styles"
import { formatarDataHoraPtBr } from "./date-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Viagem = Awaited<ReturnType<typeof buscarViagens>>[number]

type GrupoStatus = "AGUARDANDO_INICIO" | "EM_ANDAMENTO" | "POSTERGADA" | "FINALIZADA" | "CANCELADA"

const ordemGrupos: GrupoStatus[] = [
  "EM_ANDAMENTO",
  "AGUARDANDO_INICIO",
  "POSTERGADA",
  "FINALIZADA",
  "CANCELADA",
]

const tituloGrupo: Record<GrupoStatus, string> = {
  AGUARDANDO_INICIO: "Aguardando início",
  EM_ANDAMENTO: "Em andamento",
  POSTERGADA: "Postergadas",
  FINALIZADA: "Finalizadas",
  CANCELADA: "Canceladas",
}

function resolverGrupoStatus(viagem: Viagem, agora: Date): GrupoStatus {
  if (viagem.status === "CANCELADA") {
    return "CANCELADA"
  }

  if (viagem.status === "FINALIZADA" || viagem.fimPrevisto <= agora) {
    return "FINALIZADA"
  }

  if (viagem.status === "POSTERGADA") {
    return "POSTERGADA"
  }

  if (
    viagem.status === "EM_CURSO" ||
    viagem.status === "INICIADA" ||
    viagem.status === "RETORNANDO" ||
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
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700">Caminhão</TableHead>
            <TableHead className="font-semibold text-slate-700">Motorista</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viagens.map((viagem: Viagem) => (
            <TableRow key={viagem.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{viagem.numViagem}</TableCell>
              <TableCell>{formatarDataHoraPtBr(viagem.inicioPrevisto)}</TableCell>
              <TableCell>{formatarDataHoraPtBr(viagem.fimPrevisto)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
                  {viagem.turno}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
                    {formatarStatusViagem(viagem.status)}
                  </Badge>
                  <AtualizarStatusRapido viagemId={viagem.id} statusAtual={viagem.status} />
                </div>
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
                  <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
                    Pendente Alocação
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/api/viagens/${viagem.id}/pdf`}>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </Link>
                  <Link href={`/viagens/editar/${viagem.id}`}>
                    <Button variant="outline" size="sm">Editar</Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type SearchParamsInput = {
  status?: string
}

function parseStatusFiltro(valor?: string) {
  if (!valor || valor === "TODOS") {
    return "TODOS" as const
  }

  return ehStatusViagem(valor) ? valor : "TODOS"
}

export default async function ViagensPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const filtroStatus = parseStatusFiltro(parametros.status)
  const viagens = await buscarViagens()
  const viagensFiltradas =
    filtroStatus === "TODOS" ? viagens : viagens.filter((viagem) => viagem.status === filtroStatus)
  const agora = new Date()

  const grupos = viagensFiltradas.reduce<Record<GrupoStatus, Viagem[]>>(
    (acumulado: Record<GrupoStatus, Viagem[]>, viagem: Viagem) => {
      acumulado[resolverGrupoStatus(viagem, agora)].push(viagem)
      return acumulado
    },
    {
      AGUARDANDO_INICIO: [],
      EM_ANDAMENTO: [],
      POSTERGADA: [],
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
          <Link href="/viagens">
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>Todos</Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.filter((status) => status.valor !== "EM_CURSO").map((status) => (
            <Link key={status.valor} href={`/viagens?status=${status.valor}`}>
              <Button variant={filtroStatus === status.valor ? "default" : "outline"}>
                {status.label}
              </Button>
            </Link>
          ))}
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

      {viagensFiltradas.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Truck className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhuma viagem encontrada para este filtro.</p>
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