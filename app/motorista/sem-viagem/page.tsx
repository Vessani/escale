import Link from "next/link"
import { UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_LEITURA } from "@/lib/papeis"
import { buscarMotoristasSemViagemNoDia, contarMotoristasAtivos } from "@/lib/queries/motoristas"
import { completarFolgasDoRelatorio, mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { buscarCoberturaRelatorioJornada } from "@/lib/queries/filiais"
import { determinarAcaoSugerida } from "@/lib/services/motoristas-ociosos.service"
import { diaParaTexto } from "@/lib/relatorios/periodo"
import { inicioDoDia } from "@/lib/utils/date-format"
import SemViagemClient from "./sem-viagem-client"

type Dia = "hoje" | "amanha"

const ROTULO_DIA: Record<Dia, string> = { hoje: "hoje", amanha: "amanhã" }

/** "quinta-feira, 29/10" — no fuso de Brasília. */
function descreverDia(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(data)
}

/**
 * Motoristas sem viagem num dia, com a ação sugerida (dar folga, revisar
 * interno/manutenção). Abre em AMANHÃ: a escala do dia seguinte é montada
 * hoje, então é aí que dá tempo de alocar ou dar folga. `?dia=hoje` olha o dia
 * corrente. Os botões gravam a jornada no dia escolhido.
 */
export default async function MotoristasSemViagemPage({ searchParams }: { searchParams?: Promise<{ dia?: string }> }) {
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_LEITURA)
  const dia: Dia = (await searchParams)?.dia === "hoje" ? "hoje" : "amanha"
  const agora = new Date()
  // Meio-dia do dia escolhido em Brasília: longe da virada, seguro pra projetar e formatar.
  const dataDoDia = new Date(inicioDoDia(agora).getTime() + (dia === "amanha" ? 36 : 12) * 60 * 60 * 1000)
  const rotulo = ROTULO_DIA[dia]

  const [motoristas, totalMotoristas, coberturaRelatorio] = await Promise.all([
    buscarMotoristasSemViagemNoDia(filialId, dataDoDia),
    contarMotoristasAtivos(filialId),
    buscarCoberturaRelatorioJornada(filialId),
  ])

  const motoristasComAcao = motoristas.map((motorista) => {
    const registrosProjetados = completarFolgasDoRelatorio(mapearRegistrosJornada(motorista.registrosJornada), coberturaRelatorio)
    const codigoNoDia = projetarCodigoNoDia(registrosProjetados, dataDoDia, agora, motorista.diasTrabalhados)
    return {
      id: motorista.id,
      nome: motorista.nome,
      seva: motorista.seva,
      turno: motorista.turno,
      tipo: motorista.tipo,
      codigoNoDia,
      acao: determinarAcaoSugerida(codigoNoDia, motorista.tipo, rotulo),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Motoristas sem viagem {rotulo}</h1>
          <p className="text-muted-foreground mt-1">
            <span className="capitalize">{descreverDia(dataDoDia)}</span> · {motoristasComAcao.length} de {totalMotoristas} motoristas sem
            viagem, com a ação sugerida.
          </p>
        </div>
        <div role="group" aria-label="Dia" className="inline-flex rounded-lg border bg-muted/40 p-1">
          {(["hoje", "amanha"] as const).map((opcao) => (
            <Button
              key={opcao}
              asChild
              size="sm"
              variant="ghost"
              className={
                opcao === dia
                  ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border hover:bg-background"
                  : "text-muted-foreground"
              }
            >
              <Link
                href={opcao === "amanha" ? "/motorista/sem-viagem" : "/motorista/sem-viagem?dia=hoje"}
                aria-current={opcao === dia ? "page" : undefined}
              >
                {opcao === "hoje" ? "Hoje" : "Amanhã (D+1)"}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {motoristasComAcao.length === 0 ? (
        <EmptyState icone={UserX} titulo="Todos em viagem" descricao={`Todos os motoristas têm viagem ${rotulo}.`} />
      ) : (
        <SemViagemClient motoristas={motoristasComAcao} dataReferencia={diaParaTexto(dataDoDia)} rotuloDia={rotulo} />
      )}
    </div>
  )
}
