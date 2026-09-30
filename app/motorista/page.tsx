import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ChevronLeft, ChevronRight, PlusCircle, Upload, Users } from "lucide-react"
import { buscarMotoristasComAgenda } from "@/lib/queries/motoristas"
import { serializeData } from "@/lib/serialization"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import CalendarioMotoristas from "./calendario-motoristas"
import {
  formatarDataDia,
  formatarIntervaloDias,
  gerarJanelaDias,
  parseDataInicioParam,
  TAMANHO_JANELA_CALENDARIO,
} from "./calendario-utils"

type SearchParamsInput = {
  inicio?: string
}

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const hoje = new Date()
  const inicioJanela = parseDataInicioParam(parametros.inicio) ?? inicioDoDia(hoje)
  const dias = gerarJanelaDias(inicioJanela, TAMANHO_JANELA_CALENDARIO)
  const fimJanela = fimDoDia(dias[dias.length - 1])
  const janelaAnterior = new Date(inicioJanela)
  janelaAnterior.setDate(janelaAnterior.getDate() - TAMANHO_JANELA_CALENDARIO)
  const janelaSeguinte = new Date(inicioJanela)
  janelaSeguinte.setDate(janelaSeguinte.getDate() + TAMANHO_JANELA_CALENDARIO)

  const { session, filialId } = await requireSessaoPaginaComFilial()
  const podeExcluir = session.user.role === "ADMIN"
  const motoristas = await buscarMotoristasComAgenda(filialId, inicioJanela, fimJanela)
  const inicioParam = formatarDataDia(inicioJanela)
  const diasIso = dias.map((dia) => formatarDataDia(dia))
  const calendarioSerializado = serializeData(
    motoristas.map((motorista) => ({
      id: motorista.id,
      nome: motorista.nome,
      turno: motorista.turno,
      seva: motorista.seva,
      diasTrabalhados: motorista.diasTrabalhados,
      tipo: motorista.tipo,
      viagens: motorista.viagens.map((viagem) => ({
        id: viagem.id,
        numViagem: viagem.numViagem,
        inicioPrevisto: viagem.inicioPrevisto,
        fimPrevisto: viagem.fimPrevisto,
      })),
      registrosJornada: motorista.registrosJornada.map((registro) => ({
        data: registro.data,
        codigo: registro.codigo,
        inicioJornada: registro.inicioJornada,
        fimJornada: registro.fimJornada,
      })),
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendário de Motoristas</h1>
          <p className="text-muted-foreground mt-1">
            Jornada e viagens por dia ({formatarIntervaloDias(inicioJanela, dias[dias.length - 1])}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/motorista?inicio=${formatarDataDia(janelaAnterior)}`}>
            <Button variant="outline">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Dias anteriores
            </Button>
          </Link>
          <Link href="/motorista">
            <Button variant="outline">Hoje</Button>
          </Link>
          <Link href={`/motorista?inicio=${formatarDataDia(janelaSeguinte)}`}>
            <Button variant="outline">
              Próximos dias
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/motorista/importar-jornada">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Importar Jornada
            </Button>
          </Link>
          <Link href="/motorista/novo">
            <Button className="shadow-sm">
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Motorista
            </Button>
          </Link>
        </div>
      </div>

      {motoristas.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo="Nenhum motorista"
          descricao="Nenhum motorista cadastrado ainda."
          acao={
            <Link href="/motorista/novo">
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" />
                Novo motorista
              </Button>
            </Link>
          }
        />
      ) : (
        <CalendarioMotoristas
          inicioParam={inicioParam}
          hojeIso={hoje.toISOString()}
          dias={diasIso}
          motoristas={calendarioSerializado}
          podeExcluir={podeExcluir}
        />
      )}
    </div>
  )
}