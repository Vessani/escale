import {
  BedDouble,
  CalendarX,
  Clock,
  FileQuestion,
  MoonStar,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarNomesMotoristas } from "@/lib/queries/motoristas"
import { buscarIndicadoresDashboard } from "@/lib/queries/dashboard"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { buscarFolgasEstouradas } from "@/lib/queries/sem-folga"
import { contarAlertasOperacao } from "@/lib/queries/relatorios/operacao"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { DIAS_INTEGRACAO_PADRAO } from "@/lib/services/relatorios/operacao"
import RelatoriosClient from "./relatorios-client"
import DashboardRelatorios from "./dashboard-relatorios"
import { GradeRelatorios } from "./cartoes-relatorio"

type SearchParamsInput = {
  de?: string
  ate?: string
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const periodoIndicadores = periodoOuPadrao(parametros.de, parametros.ate, { diasAntes: 30, diasDepois: 0 })
  const periodoCircadiano = periodoOuPadrao(undefined, undefined, PERIODO_PADRAO.circadiano)
  const periodoSemFolga = periodoOuPadrao(undefined, undefined, PERIODO_PADRAO.semFolga)

  const { filialId } = await requireSessaoPaginaComFilial()
  const [motoristas, indicadores, circadiano, semFolga, alertas] = await Promise.all([
    buscarNomesMotoristas(filialId),
    buscarIndicadoresDashboard(filialId, periodoIndicadores.de, periodoIndicadores.ate),
    buscarRelatorioCircadiano(filialId, periodoCircadiano.de, periodoCircadiano.ate),
    buscarFolgasEstouradas(filialId, periodoSemFolga.de, periodoSemFolga.ate),
    contarAlertasOperacao(filialId, DIAS_INTEGRACAO_PADRAO),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">
          Jornada dos motoristas, operação e indicadores das viagens — todos com tela e Excel.
        </p>
      </div>

      <GradeRelatorios
        titulo="Jornada e segurança"
        cartoes={[
          {
            href: "/relatorios/circadiano",
            titulo: "Ciclo circadiano",
            descricao: "Turno do dia passando das 22:00 e da noite passando das 05:00 — previsto e realizado.",
            icone: MoonStar,
            contagem: circadiano.previstas.length,
            contagemTexto: circadiano.previstas.length === 1 ? "viagem agendada vai passar" : "viagens agendadas vão passar",
          },
          {
            href: "/relatorios/sem-folga",
            titulo: "Dias sem folga",
            descricao: "Quem trabalhou o 7º dia seguido (ou mais) sem folga.",
            icone: CalendarX,
            contagem: semFolga.length,
            contagemTexto: "nos últimos 30 dias",
          },
          {
            href: "/relatorios/interjornada",
            titulo: "Descanso não cumprido",
            descricao: "Quem voltou antes de 11h de descanso (ou 35h depois do 6º dia), pelo relatório de jornada.",
            icone: BedDouble,
          },
          {
            href: "/relatorios/jornadas-longas",
            titulo: "Jornadas longas",
            descricao: "Jornadas reais acima de um limite de horas, com a viagem que o motorista fazia.",
            icone: Timer,
          },
          {
            href: "/relatorios/motoristas",
            titulo: "Painel por motorista",
            descricao: "Dias e horas trabalhadas, viagens e alertas de cada motorista no mês.",
            icone: Users,
          },
        ]}
      />

      <GradeRelatorios
        titulo="Operação"
        cartoes={[
          {
            href: "/relatorios/integracoes",
            titulo: "Integrações vencendo",
            descricao: "Integrações com clientes vencidas ou vencendo — renove antes de travar a alocação.",
            icone: ShieldCheck,
            contagem: alertas.integracoes,
            contagemTexto: `vencida(s) ou vencendo em ${DIAS_INTEGRACAO_PADRAO} dias`,
          },
          {
            href: "/relatorios/pontualidade",
            titulo: "Pontualidade de saída",
            descricao: "Saída real x prevista: atrasos por motivo, motorista e cliente.",
            icone: Clock,
          },
          {
            href: "/relatorios/avisos",
            titulo: "Viagens com aviso",
            descricao: "Viagens que foram com aviso de descanso ou de frota, e quem alterou por último.",
            icone: TriangleAlert,
          },
          {
            href: "/relatorios/frota",
            titulo: "Uso da frota",
            descricao: "Dias em viagem e ocupação de cada conjunto; os parados primeiro.",
            icone: Truck,
          },
          {
            href: "/relatorios/nao-consta",
            titulo: "Não consta no relatório",
            descricao: "Viagens que o relatório de jornada desmente — pra cancelar ou corrigir.",
            icone: FileQuestion,
            contagem: alertas.naoConstam,
            contagemTexto: alertas.naoConstam === 1 ? "viagem pendente" : "viagens pendentes",
          },
        ]}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Indicadores das viagens</h2>
        <DashboardRelatorios indicadores={indicadores} de={periodoIndicadores.deTexto} ate={periodoIndicadores.ateTexto} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Planilhas de viagens</h2>
        <RelatoriosClient motoristas={motoristas} />
      </section>
    </div>
  )
}
