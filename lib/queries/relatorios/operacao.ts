import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal, inicioDoDia } from "@/lib/utils/date-format"
import type { VeiculoManutencao } from "@prisma/client"
import type {
  IntegracaoParaRelatorio,
  VeiculoDisponibilidade,
  ViagemDisponibilidade,
  ViagemPontualidade,
} from "@/lib/services/relatorios/operacao"
import { soEntregasDeCliente } from "@/lib/services/entrega-cliente"
import { frotaEhValida } from "@/lib/services/frota-regras"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** 4. Integrações de motoristas ativos com validade até `dias` dias a partir de hoje (inclui vencidas). */
export async function buscarIntegracoesParaRelatorio(
  filialId: number,
  dias: number,
  hoje = new Date(),
): Promise<IntegracaoParaRelatorio[]> {
  const limite = new Date(inicioDoDia(hoje).getTime() + (dias + 1) * UM_DIA_MS)
  const integracoes = await prisma.integracao.findMany({
    where: { motorista: { filialId, deletadoEm: null }, dataValidade: { lt: limite } },
    select: { cliente: true, status: true, dataValidade: true, motorista: { select: { id: true, nome: true } } },
  })

  return integracoes.flatMap((integracao) =>
    integracao.motorista
      ? [
          {
            motoristaId: integracao.motorista.id,
            motorista: integracao.motorista.nome,
            cliente: integracao.cliente,
            status: integracao.status,
            dataValidade: colunaDateParaLocal(integracao.dataValidade),
          },
        ]
      : [],
  )
}

/** 5. Viagens (não canceladas) previstas pra começar no período, com saída real e clientes. */
export async function buscarViagensPontualidade(filialId: number, de: Date, ate: Date): Promise<ViagemPontualidade[]> {
  const viagens = await prisma.viagem.findMany({
    where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { gte: de, lte: ate } },
    select: {
      id: true,
      numViagem: true,
      status: true,
      inicioPrevisto: true,
      horarioRealSaida: true,
      motivoAtraso: true,
      motorista: { select: { id: true, nome: true } },
      entregas: { select: { cliente: true, sapcode: true, codewhite: true } },
    },
  })

  return viagens.map(({ entregas, ...viagem }) => ({
    ...viagem,
    // Só clientes de verdade (SAP code + número white) — a origem não é cliente.
    clientes: [
      ...new Set(
        soEntregasDeCliente(entregas)
          .map((entrega) => entrega.cliente.trim())
          .filter(Boolean),
      ),
    ],
  }))
}

/** 6. Viagens do período com algum aviso gravado, com quem fez a última alteração. */
export async function buscarViagensComAviso(filialId: number, de: Date, ate: Date) {
  const viagens = await prisma.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      status: { not: "CANCELADA" },
      inicioPrevisto: { gte: de, lte: ate },
      OR: [
        { avisoInterjornada: { not: null } },
        { avisoFrotaIndisponivel: { not: null } },
        { avisoFrotaProdutoIncompativel: { not: null } },
        { avisoRelatorioJornada: { not: null } },
      ],
    },
    orderBy: { inicioPrevisto: "desc" },
    select: {
      id: true,
      numViagem: true,
      status: true,
      inicioPrevisto: true,
      cavalo: true,
      carreta: true,
      avisoInterjornada: true,
      avisoFrotaIndisponivel: true,
      avisoFrotaProdutoIncompativel: true,
      avisoRelatorioJornada: true,
      motorista: { select: { nome: true } },
    },
  })

  const auditorias =
    viagens.length === 0
      ? []
      : await prisma.registroAuditoria.findMany({
          where: { entidade: "Viagem", entidadeId: { in: viagens.map((viagem) => String(viagem.id)) } },
          orderBy: { criadoEm: "desc" },
          select: { entidadeId: true, usuarioNome: true, criadoEm: true },
        })
  const ultimaAlteracao = new Map<string, { usuarioNome: string | null; criadoEm: Date }>()
  for (const auditoria of auditorias) {
    if (!ultimaAlteracao.has(auditoria.entidadeId)) ultimaAlteracao.set(auditoria.entidadeId, auditoria)
  }

  return viagens.map((viagem) => {
    const alteracao = ultimaAlteracao.get(String(viagem.id))
    return { ...viagem, alteradoPor: alteracao?.usuarioNome ?? null, alteradoEm: alteracao?.criadoEm ?? null }
  })
}

/**
 * 7. Cavalos e carretas (dos conjuntos cadastrados e de quem teve
 * manutenção no período), viagens e manutenções que tocam o período e a
 * última viagem de cada veículo.
 */
export async function buscarDadosDisponibilidade(filialId: number, de: Date, ate: Date) {
  const [frotas, viagens, manutencoes, ultimasCarreta, ultimasCavalo] = await Promise.all([
    prisma.frota.findMany({ where: { filialId, deletadoEm: null }, select: { cavalo: true, carreta: true } }),
    prisma.viagem.findMany({
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { lte: ate }, fimPrevisto: { gte: de } },
      select: {
        id: true,
        cavalo: true,
        carreta: true,
        status: true,
        inicioPrevisto: true,
        fimPrevisto: true,
        finalizadoEm: true,
        horarioRealSaida: true,
      },
    }),
    prisma.manutencao.findMany({
      where: { filialId, deletadoEm: null, inicioPrevisto: { lte: ate }, OR: [{ fimReal: null }, { fimReal: { gte: de } }] },
    }),
    prisma.viagem.groupBy({
      by: ["carreta"],
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { lte: ate } },
      _max: { inicioPrevisto: true },
    }),
    prisma.viagem.groupBy({
      by: ["cavalo"],
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { lte: ate } },
      _max: { inicioPrevisto: true },
    }),
  ])

  const veiculos = new Map<string, VeiculoDisponibilidade>()
  const adicionar = (veiculo: VeiculoManutencao, codigo: string, conjunto: string | null) => {
    if (!frotaEhValida(codigo)) return
    const chave = `${veiculo}:${codigo}`
    if (!veiculos.has(chave)) veiculos.set(chave, { veiculo, codigo, conjunto })
  }
  for (const frota of frotas) {
    const conjunto = `${frota.cavalo} / ${frota.carreta}`
    adicionar("CARRETA", frota.carreta, conjunto)
    // Truck: cavalo e carreta com o mesmo número — conta uma vez só, como carreta.
    if (frota.cavalo !== frota.carreta) adicionar("CAVALO", frota.cavalo, conjunto)
  }
  for (const manutencao of manutencoes) adicionar(manutencao.veiculo, manutencao.codigo, null)

  const ultimaViagemPorVeiculo = new Map<string, Date>()
  for (const u of ultimasCarreta) if (u._max.inicioPrevisto) ultimaViagemPorVeiculo.set(`CARRETA:${u.carreta}`, u._max.inicioPrevisto)
  for (const u of ultimasCavalo) if (u._max.inicioPrevisto) ultimaViagemPorVeiculo.set(`CAVALO:${u.cavalo}`, u._max.inicioPrevisto)

  return { veiculos: [...veiculos.values()], viagens: viagens as ViagemDisponibilidade[], manutencoes, ultimaViagemPorVeiculo }
}

/** Contagens pros cards da tela de Relatórios (uma consulta leve cada). */
export async function contarAlertasOperacao(filialId: number, diasIntegracao: number, hoje = new Date()) {
  const limite = new Date(inicioDoDia(hoje).getTime() + (diasIntegracao + 1) * UM_DIA_MS)
  const integracoes = await prisma.integracao.count({
    where: { motorista: { filialId, deletadoEm: null }, dataValidade: { lt: limite } },
  })
  return { integracoes }
}
