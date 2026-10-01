import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal, inicioDoDia } from "@/lib/utils/date-format"
import type { IntegracaoParaRelatorio, ViagemPontualidade, FrotaParaUso, ViagemParaUso } from "@/lib/services/relatorios/operacao"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** 4. Integrações de motoristas ativos com validade até `dias` dias a partir de hoje (inclui vencidas). */
export async function buscarIntegracoesParaRelatorio(filialId: number, dias: number, hoje = new Date()): Promise<IntegracaoParaRelatorio[]> {
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
      entregas: { select: { cliente: true } },
    },
  })

  return viagens.map(({ entregas, ...viagem }) => ({
    ...viagem,
    clientes: [...new Set(entregas.map((entrega) => entrega.cliente.trim()).filter(Boolean))],
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

/** 7. Conjuntos ativos, viagens que tocam o período e a última viagem de cada carreta. */
export async function buscarDadosUsoFrota(filialId: number, de: Date, ate: Date) {
  const [frotas, viagens, ultimas] = await Promise.all([
    prisma.frota.findMany({
      where: { filialId, deletadoEm: null },
      select: { id: true, cavalo: true, carreta: true, emManutencao: true, tipoProduto: true },
    }),
    prisma.viagem.findMany({
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { lte: ate }, fimPrevisto: { gte: de } },
      select: { id: true, carreta: true, status: true, inicioPrevisto: true, fimPrevisto: true, finalizadoEm: true },
    }),
    prisma.viagem.groupBy({
      by: ["carreta"],
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, inicioPrevisto: { lte: ate } },
      _max: { inicioPrevisto: true },
    }),
  ])

  const ultimaViagemPorCarreta = new Map<string, Date>()
  for (const ultima of ultimas) {
    if (ultima._max.inicioPrevisto) ultimaViagemPorCarreta.set(ultima.carreta, ultima._max.inicioPrevisto)
  }

  return { frotas: frotas as FrotaParaUso[], viagens: viagens as ViagemParaUso[], ultimaViagemPorCarreta }
}

/** 8. Viagens que o relatório de jornada desmente (ver viagemDesmentidaPeloRelatorio) e ainda não foram resolvidas. */
export async function buscarViagensNaoConstam(filialId: number) {
  return prisma.viagem.findMany({
    where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, avisoRelatorioJornada: { not: null } },
    orderBy: { inicioPrevisto: "desc" },
    select: {
      id: true,
      numViagem: true,
      status: true,
      inicioPrevisto: true,
      fimPrevisto: true,
      cavalo: true,
      carreta: true,
      motorista: { select: { nome: true } },
    },
  })
}

/** Contagens pros cards da tela de Relatórios (uma consulta leve cada). */
export async function contarAlertasOperacao(filialId: number, diasIntegracao: number, hoje = new Date()) {
  const limite = new Date(inicioDoDia(hoje).getTime() + (diasIntegracao + 1) * UM_DIA_MS)
  const [integracoes, naoConstam] = await Promise.all([
    prisma.integracao.count({ where: { motorista: { filialId, deletadoEm: null }, dataValidade: { lt: limite } } }),
    prisma.viagem.count({
      where: { filialId, deletadoEm: null, status: { not: "CANCELADA" }, avisoRelatorioJornada: { not: null } },
    }),
  ])
  return { integracoes, naoConstam }
}
