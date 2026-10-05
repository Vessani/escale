import { prisma } from "@/lib/prisma";
import { Prisma, Turno } from "@prisma/client";
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format";
import { completarHistoricoComAncora, filtroJanelaJornada, inicioJanelaJornada } from "./jornada-historico";

/**
 * Margem sobre o maior descanso legal (35h, descanso semanal) usada pra
 * decidir até quando uma viagem FINALIZADA ainda é relevante pro cálculo de
 * disponibilidade — ver limiteFinalizadaRelevante/filtroViagemAtiva.
 */
export const HORAS_FINALIZADA_RELEVANTE = 48

/** A partir de que instante uma viagem FINALIZADA ainda pode influenciar o descanso mínimo de uma nova alocação. */
export function limiteFinalizadaRelevante(agora: Date): Date {
  return new Date(agora.getTime() - HORAS_FINALIZADA_RELEVANTE * 60 * 60 * 1000)
}

/**
 * Filtro de viagem "ativa" usado nas duas agendas (principal e acompanhante)
 * — ver motivo em buscarMotoristas/buscarMotoristasParaSelect. CANCELADA
 * nunca conta (a viagem não aconteceu, não gera descanso a cumprir).
 * FINALIZADA conta só se terminou há pouco tempo — o suficiente pra ainda
 * poder violar o descanso mínimo de uma nova alocação (ver
 * MINIMO_HORAS_ENTRE_FOLGAS em alocacao.service.ts); sem esse limite, toda
 * viagem já finalizada na história do motorista seria carregada pra sempre
 * nessa consulta.
 */
export function filtroViagemAtiva(agora: Date) {
  return {
    deletadoEm: null,
    OR: [
      { status: { notIn: ["CANCELADA", "FINALIZADA"] } },
      { status: "FINALIZADA", fimPrevisto: { gte: limiteFinalizadaRelevante(agora) } },
    ],
  } satisfies Prisma.ViagemWhereInput
}

export const SELECT_VIAGEM_AGENDA = {
  id: true,
  inicioPrevisto: true,
  fimPrevisto: true,
  status: true,
  deletadoEm: true,
  // Viagem finalizada libera o motorista a partir daqui — ver fimEfetivoViagem.
  finalizadoEm: true,
} as const

export async function buscarMotoristas(filialId: number) {
  const filtroViagem = filtroViagemAtiva(new Date())
  const desde = inicioJanelaJornada(new Date())
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null,
      filialId,
    },
    orderBy: { nome: 'asc' },
    include: {
      // Até que dia o Relatório de Jornada cobre — ver viagemDesmentidaPeloRelatorio.
      filial: { select: { relatorioJornadaAte: true } },
      integracao: true,
      viagens: { where: filtroViagem, select: SELECT_VIAGEM_AGENDA },
      // Viagens onde ele é acompanhante também contam como agenda ocupada —
      // unidas com `viagens` abaixo, pra quem aloca (alocacao.service.ts) só
      // precisar considerar "as viagens desse motorista", sem saber do papel.
      viagensComoAcompanhante: { where: filtroViagem, select: SELECT_VIAGEM_AGENDA },
      // Histórico de jornada (só a janela recente + âncora, ver
      // jornada-historico.ts): permite projetar o código do motorista na
      // data real de início de cada viagem (ver alocacao.service.ts).
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        orderBy: { data: "asc" },
      },
    },
  });

  const comAncora = await completarHistoricoComAncora(motoristas, desde)
  return comAncora.map(({ viagensComoAcompanhante, ...motorista }) => ({
    ...motorista,
    viagens: [...motorista.viagens, ...viagensComoAcompanhante],
  }))
}


export async function buscarMotoristaPorId(filialId: number, id: number) {
  return await prisma.motorista.findFirst({
    where: {
      id: id,
      filialId,
      deletadoEm: null
    },
    include: {
      integracao: true,
      // Histórico de jornada: permite projetar o código de hoje a partir do
      // registro real mais recente, em vez do cache diasTrabalhados (que só
      // é atualizado quando algo escreve explicitamente no dia de hoje).
      registrosJornada: {
        select: { data: true, codigo: true },
        orderBy: { data: "asc" },
      },
    },
  });
}


export async function buscarMotoristasParaSelect(filialId: number, turnoDaViagem?: Turno) {
  const filtroViagem = filtroViagemAtiva(new Date())
  const desde = inicioJanelaJornada(new Date())
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null,
      filialId,

      ...(turnoDaViagem ? { turno: turnoDaViagem } : {})
    },
    select: {
      id: true,
      nome: true,
      turno: true,
      diasTrabalhados: true,
      tipo: true,
      produtosAutorizados: true,
      jornadaRelatorioInicio: true,
      jornadaRelatorioFim: true,
      // Até que dia o Relatório de Jornada cobre — ver viagemDesmentidaPeloRelatorio.
      filial: { select: { relatorioJornadaAte: true } },
      integracao: {
        select: {
          cliente: true,
          status: true,
          dataValidade: true,
        },
      },
      viagens: { where: filtroViagem, select: SELECT_VIAGEM_AGENDA },
      viagensComoAcompanhante: { where: filtroViagem, select: SELECT_VIAGEM_AGENDA },
      // Histórico de jornada: permite projetar o código do motorista na data
      // real de início de cada viagem, e achar o fim real da jornada anterior
      // pra referência de interjornada (ver alocacao.service.ts e
      // encontrarFimJornadaAnterior em jornada.service.ts).
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        select: { data: true, codigo: true, fimJornada: true },
        orderBy: { data: "asc" },
      },
    },
    orderBy: { nome: 'asc' }
  });

  const comAncora = await completarHistoricoComAncora(motoristas, desde)
  return comAncora.map(({ viagensComoAcompanhante, ...motorista }) => ({
    ...motorista,
    viagens: [...motorista.viagens, ...viagensComoAcompanhante],
  }))
}

/**
 * Motoristas ativos sem nenhuma viagem cobrindo o dia de referência (nem
 * como principal, nem como acompanhante) — mesma definição de "sem
 * atividade hoje" usada por reconciliarFolgaMotoristasNoDiaAtual
 * (folga.service.ts), só que aqui pra listar todo mundo de uma vez em vez
 * de reconciliar reativamente um motorista específico.
 */
export async function buscarMotoristasSemViagemHoje(filialId: number, dataReferencia = new Date()) {
  const inicioDia = inicioDoDia(dataReferencia)
  const fimDia = fimDoDia(dataReferencia)
  const filtroAtividadeNoDia = {
    deletadoEm: null,
    status: { notIn: ["CANCELADA", "FINALIZADA"] },
    inicioPrevisto: { lte: fimDia },
    fimPrevisto: { gte: inicioDia },
  } satisfies Prisma.ViagemWhereInput

  const desde = inicioJanelaJornada(dataReferencia)
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null,
      filialId,
      viagens: { none: filtroAtividadeNoDia },
      viagensComoAcompanhante: { none: filtroAtividadeNoDia },
    },
    select: {
      id: true,
      nome: true,
      seva: true,
      turno: true,
      diasTrabalhados: true,
      tipo: true,
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        select: { data: true, codigo: true },
        orderBy: { data: "asc" },
      },
    },
    orderBy: { nome: "asc" },
  })

  return completarHistoricoComAncora(motoristas, desde)
}

export async function contarMotoristasAtivos(filialId: number) {
  return prisma.motorista.count({ where: { deletadoEm: null, filialId } })
}

export async function buscarMotoristasComAgenda(filialId: number, inicio: Date, fim: Date) {
  // Histórico a partir do início do período visível, mais a âncora de antes
  // dele (ver jornada-historico.ts) — a projeção de um dia sem registro
  // próprio usa o registro conhecido mais próximo, que pode ser de um mês
  // anterior, e a âncora cobre exatamente esse caso.
  const desde = inicioJanelaJornada(inicio, 0)
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null,
      filialId,
    },
    orderBy: { nome: "asc" },
    include: {
      integracao: true,
      viagens: {
        where: {
          deletadoEm: null,
          status: { not: "CANCELADA" },
          inicioPrevisto: { lte: fim },
          fimPrevisto: { gte: inicio },
        },
        orderBy: { inicioPrevisto: "asc" },
      },
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        orderBy: { data: "asc" },
      },
    },
  });

  return completarHistoricoComAncora(motoristas, desde)
}
/**
 * Listagem da API (/api/motoristas), pra consumo externo: só o necessário,
 * e nunca o CPF — dado pessoal que não precisa sair do sistema por aqui.
 */
export async function buscarMotoristasParaApi(filialId: number) {
  return prisma.motorista.findMany({
    where: { deletadoEm: null, filialId },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      tipo: true,
      turno: true,
      seva: true,
      produtosAutorizados: true,
      integracao: { select: { id: true, cliente: true, dataValidade: true, status: true } },
    },
  })
}
/** Matrículas (SEVA) dos motoristas ativos da filial — a conferência do relatório de jornada mostra só esses. */
export async function buscarMatriculasCadastradas(filialId: number): Promise<number[]> {
  const motoristas = await prisma.motorista.findMany({ where: { filialId, deletadoEm: null }, select: { seva: true } })
  return [...new Set(motoristas.map((motorista) => motorista.seva))]
}
