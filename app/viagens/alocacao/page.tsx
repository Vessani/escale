import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMotoristas } from "@/lib/queries/motoristas"
import { buscarViagensSemMotorista } from "@/lib/queries/viagens"
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes"
import type { ViagemAlocacao } from "@/lib/types/alocacao"
import {
  calcularAvisoDescanso,
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  calcularProximoInicioDisponivel,
  encontrarFimTrabalhoAnterior,
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
function serializarViagens(
  viagensBrutas: ViagemBase[],
  motoristasBrutos: MotoristaBase[],
  hoje: Date,
  numerosSapQueExigemIntegracao: Set<string>,
): ViagemAlocacao[] {
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
    integracaoExigida: viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas, numerosSapQueExigemIntegracao),
    produtoExigido: viagem.produto,
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
      produto: viagem.produto,
      motoristaId: viagem.motoristaId,
      integracaoExigida: viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas, numerosSapQueExigemIntegracao),
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
      // Mesma regra do aviso gravado na viagem (relatório + viagens, finalizada
      // contando da finalização, 11h/35h) — ver calcularAvisoDescanso.
      avisoInterjornada: motoristaSugerido
        ? calcularAvisoDescanso(motoristaSugerido, { id: viagem.id, inicioPrevisto: viagem.inicioPrevisto }, hoje)
        : null,
      // Já calculado e persistido na criação/edição da viagem — ver calcularAvisoFrotaIndisponivel (frota.service.ts).
      avisoFrotaIndisponivel: viagem.avisoFrotaIndisponivel,
      avisoFrotaProdutoIncompativel: viagem.avisoFrotaProdutoIncompativel,
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

        const proximoInicioDisponivel = calcularProximoInicioDisponivel(
          encontrarFimTrabalhoAnterior(motorista, new Date(viagem.inicioPrevisto), viagem.id),
          motorista.diasTrabalhados,
        )

        return {
          id: motorista.id,
          nome: motorista.nome,
          diasTrabalhados: codigoNaViagem,
          diasDisponiveis: calcularDiasDisponiveis(codigoNaViagem),
          turno: motorista.turno,
          horarioHabitual: motorista.jornadaRelatorioInicio ? formatarHoraLocal(motorista.jornadaRelatorioInicio) : null,
          proximoInicioDisponivel: proximoInicioDisponivel ? formatarHoraLocal(proximoInicioDisponivel) : null,
        }
      }),
    }
  })
}

export default async function PaginaAlocacaoViagens() {
  const { filialId } = await requireSessaoPaginaComFilial()
  const [viagensBrutas, motoristasBrutos, numerosSapQueExigemIntegracao] = await Promise.all([
    buscarViagensSemMotorista(filialId),
    buscarMotoristas(filialId),
    buscarNumerosSapQueExigemIntegracao(),
  ])

  const hoje = inicioDoDia(new Date())
  const viagens = serializarViagens(viagensBrutas, motoristasBrutos, hoje, numerosSapQueExigemIntegracao)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alocação de Viagens</h1>
          <p className="mt-1 text-muted-foreground">
            Viagens pendentes e os motoristas compatíveis com cada uma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/viagens">
            <Button variant="outline">Voltar para Viagens</Button>
          </Link>
          <Link href="/viagens/nova">
            <Button>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-foreground/80" />
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
