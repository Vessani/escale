import {
  BedDouble,
  CalendarX,
  Clock,
  ListOrdered,
  MoonStar,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarNomesMotoristas } from "@/lib/queries/motoristas"
import { buscarIndicadoresDashboard } from "@/lib/queries/dashboard"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { buscarEstourosSetimoDia } from "@/lib/queries/estouro-setimo-dia"
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
  const periodoSetimoDia = periodoOuPadrao(undefined, undefined, PERIODO_PADRAO.estouroSetimoDia)

  const { filialId } = await requireSessaoPaginaComFilial()
  const [motoristas, indicadores, circadiano, estourosSetimoDia, alertas] = await Promise.all([
    buscarNomesMotoristas(filialId),
    buscarIndicadoresDashboard(filialId, periodoIndicadores.de, periodoIndicadores.ate),
    buscarRelatorioCircadiano(filialId, periodoCircadiano.de, periodoCircadiano.ate),
    buscarEstourosSetimoDia(filialId, periodoSetimoDia.de, periodoSetimoDia.ate),
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
            descricao: "Jornada do dia passando das 22:00 e da noite passando das 05:00 (turno pelo início da jornada) — previsto e realizado.",
            icone: MoonStar,
            contagem: circadiano.previstas.length,
            contagemTexto: circadiano.previstas.length === 1 ? "viagem agendada vai passar" : "viagens agendadas vão passar",
          },
          {
            href: "/relatorios/estouro-7-dia",
            titulo: "Estouro de 7º dia",
            descricao: "Quem trabalhou o 7º dia seguido, ou folgou menos de 35h depois do 6º dia.",
            icone: CalendarX,
            contagem: estourosSetimoDia.length,
            contagemTexto: "nos últimos 30 dias",
          },
          {
            href: "/relatorios/quebra-intersticio",
            titulo: "Quebra de interstício",
            descricao: "Quem voltou a trabalhar antes de 11h de descanso, pelo relatório de jornada.",
            icone: BedDouble,
          },
          {
            href: "/relatorios/estouro-jornada",
            titulo: "Estouro de jornada",
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
            href: "/relatorios/viagens",
            titulo: "Viagens",
            descricao: "Todas as viagens, uma por linha: motorista, produto, cidades, km e pedágio/pernoite.",
            icone: ListOrdered,
          },
          {
            href: "/relatorios/km-custos",
            titulo: "Km e custos por viagem",
            descricao: "Km rodado, pedágio e pernoite que o motorista lançou, com início, fim e a região de cada viagem.",
            icone: Wallet,
          },
          {
            href: "/relatorios/frota",
            titulo: "Disponibilidade da frota",
            descricao: "Horas em rota, paradas em manutenção (White Martins / Ritmo) e disponíveis, por carreta e cavalo.",
            icone: Truck,
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
