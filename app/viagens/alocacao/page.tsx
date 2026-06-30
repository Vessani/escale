import Link from "next/link"
import { buscarMotoristas } from "@/lib/queries/motoristas"
import { buscarViagensSemMotorista } from "@/lib/queries/viagens"
import type { ViagemAlocacao } from "@/lib/types/alocacao"
import {
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  filtrarMotoristasCompativeis,
  sugerirMotoristaAutomatico,
} from "@/lib/services/alocacao.service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, Truck } from "lucide-react"
import AlocacaoViagensClient from "./viagens-alocacao-client"

type ViagemBase = Awaited<ReturnType<typeof buscarViagensSemMotorista>>[number]
type MotoristaBase = Awaited<ReturnType<typeof buscarMotoristas>>[number]

function serializarViagem(viagem: ViagemBase, motoristas: MotoristaBase[]): ViagemAlocacao | null {
  if (viagem.motoristaId !== null) {
    return null
  }

  const dataInicio = new Date(viagem.inicioPrevisto)
  const integracaoExigida = viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas)

  const contextoAlocacao = {
    turnoViagem: viagem.turno,
    diasViagem: viagem.diasViagem,
    dataInicioViagem: dataInicio,
    integracaoExigida,
  }

  const motoristasCompativeis = filtrarMotoristasCompativeis(motoristas, contextoAlocacao)
  const motoristaSugerido = sugerirMotoristaAutomatico(motoristas, contextoAlocacao)

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
    integracaoExigida,
    entregas: viagem.entregas.map((entrega) => ({
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
    motoristasCompativeis: motoristasCompativeis.map((motorista) => ({
      id: motorista.id,
      nome: motorista.nome,
      diasTrabalhados: motorista.diasTrabalhados,
      diasDisponiveis: calcularDiasDisponiveis(motorista.diasTrabalhados),
      turno: motorista.turno,
    })),
  }
}

export default async function PaginaAlocacaoViagens() {
  const [viagensBrutas, motoristasBrutos] = await Promise.all([
    buscarViagensSemMotorista(),
    buscarMotoristas(),
  ])

  const viagens = viagensBrutas
    .map((viagem) => serializarViagem(viagem, motoristasBrutos))
    .filter((viagem): viagem is ViagemAlocacao => viagem !== null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Alocação de Viagens</h1>
          <p className="mt-1 text-slate-500">
            Cruze viagens pendentes com motoristas compatíveis e ajuste manualmente quando precisar.
          </p>
        </div>

        <div className="flex gap-3">
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
            Motoristas compatíveis são calculados por turno, dias disponíveis da jornada (até 6 consecutivos) e integração ativa válida.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <AlocacaoViagensClient viagens={viagens} />
        </CardContent>
      </Card>
    </div>
  )
}
