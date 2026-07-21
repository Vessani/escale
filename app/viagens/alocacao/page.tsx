import Link from "next/link"
import { buscarMotoristas } from "@/lib/queries/motoristas"
import { buscarViagensSemMotorista } from "@/lib/queries/viagens"
import type { ViagemAlocacao } from "@/lib/types/alocacao"
import {
  calcularAvisoInterjornada,
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  sugerirAlocacoesEmLote,
} from "@/lib/services/alocacao.service"
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { formatarHoraLocal, inicioDoDia } from "@/lib/utils/date-format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, Truck } from "lucide-react"
import AlocacaoViagensClient from "./viagens-alocacao-client"

type ViagemBase = Awaited<ReturnType<typeof buscarViagensSemMotorista>>[number]
type MotoristaBase = Awaited<ReturnType<typeof buscarMotoristas>>[number]
type EntregaBase = ViagemBase["entregas"][number]

/** Monta o view-model da tela de alocação a partir das viagens pendentes e da sugestão em lote. */
function serializarViagens(viagensBrutas: ViagemBase[], motoristasBrutos: MotoristaBase[], hoje: Date): ViagemAlocacao[] {
  const viagensPendentes = viagensBrutas.filter((viagem) => viagem.motoristaId === null)

  const motoristas = motoristasBrutos.map((motorista) => ({
    ...motorista,
    registrosJornada: mapearRegistrosJornada(motorista.registrosJornada),
  }))

  const viagensParaSugestao = viagensPendentes.map((viagem) => ({
    id: viagem.id,
    turno: viagem.turno,
    diasViagem: viagem.diasViagem,
    inicioPrevisto: new Date(viagem.inicioPrevisto),
    fimPrevisto: new Date(viagem.fimPrevisto),
    integracaoExigida: viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas),
  }))

  const sugestoesPorViagemId = new Map(
    sugerirAlocacoesEmLote(viagensParaSugestao, motoristas, hoje).map((sugestao) => [sugestao.viagemId, sugestao]),
  )

  return viagensPendentes.map((viagem) => {
    const sugestao = sugestoesPorViagemId.get(viagem.id)
    const motoristasCompativeis = sugestao?.motoristasCompativeis ?? []
    const motoristaSugerido = sugestao?.motoristaSugerido ?? null

    return {
      id: viagem.id,
      numViagem: viagem.numViagem,
      carreta: viagem.carreta,
      cavalo: viagem.cavalo,
      tanque: viagem.tanque,
      diasViagem: viagem.diasViagem,
      inicioPrevisto: new Date(viagem.inicioPrevisto).toISOString(),
      fimPrevisto: new Date(viagem.fimPrevisto).toISOString(),
      turno: viagem.turno,
      motoristaId: viagem.motoristaId,
      integracaoExigida: viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas),
      entregas: viagem.entregas.map((entrega: EntregaBase) => ({
        id: entrega.id,
        dataEntrega: new Date(entrega.dataEntrega).toISOString(),
        cliente: entrega.cliente,
        cidade: entrega.cidade,
        uf: entrega.uf,
        kg: Number(entrega.kg),
        m3: Number(entrega.m3),
        obs: entrega.obs,
        sapcode: entrega.sapcode,
        codewhite: entrega.codewhite,
      })),
      motoristaSugerido: motoristaSugerido
        ? {
            id: motoristaSugerido.id,
            nome: motoristaSugerido.nome,
          }
        : null,
      avisoInterjornada: motoristaSugerido
        ? calcularAvisoInterjornada(motoristaSugerido.jornadaRelatorioFim, new Date(viagem.inicioPrevisto))
        : null,
      motoristasCompativeis: motoristasCompativeis.map((motorista) => {
        // Mesma jornada projetada usada pra decidir compatibilidade, não o
        // cache de "hoje" — senão o número mostrado destoa do motivo real
        // pelo qual o motorista foi sugerido.
        const codigoNaViagem = projetarCodigoNoDia(
          motorista.registrosJornada,
          new Date(viagem.inicioPrevisto),
          hoje,
          motorista.diasTrabalhados,
        )

        return {
          id: motorista.id,
          nome: motorista.nome,
          diasTrabalhados: codigoNaViagem,
          diasDisponiveis: calcularDiasDisponiveis(codigoNaViagem),
          turno: motorista.turno,
          horarioHabitual: motorista.jornadaRelatorioInicio ? formatarHoraLocal(motorista.jornadaRelatorioInicio) : null,
        }
      }),
    }
  })
}

export default async function PaginaAlocacaoViagens() {
  const [viagensBrutas, motoristasBrutos] = await Promise.all([
    buscarViagensSemMotorista(),
    buscarMotoristas(),
  ])

  const hoje = inicioDoDia(new Date())
  const viagens = serializarViagens(viagensBrutas, motoristasBrutos, hoje)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Alocação de Viagens</h1>
          <p className="mt-1 text-slate-500">
            Cruze viagens pendentes com motoristas compatíveis e ajuste manualmente quando precisar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/viagens">
            <Button variant="outline">Voltar para Viagens</Button>
          </Link>
          <Link href="/viagens/nova">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-lg">Viagens sem motorista</CardTitle>
          </div>
          <CardDescription>
            Motoristas compatíveis são calculados por turno, dias disponíveis da jornada (até 6 consecutivos), integração ativa válida e disponibilidade real (sem outra viagem no mesmo período — inclusive entre viagens desta mesma lista).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <AlocacaoViagensClient viagens={viagens} />
        </CardContent>
      </Card>
    </div>
  )
}
