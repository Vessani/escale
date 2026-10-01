import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { buscarFolgasEstouradas } from "@/lib/queries/sem-folga"
import { carregarDadosJornada } from "@/lib/queries/relatorios/jornada"
import {
  buscarDadosUsoFrota,
  buscarIntegracoesParaRelatorio,
  buscarViagensComAviso,
  buscarViagensNaoConstam,
  buscarViagensPontualidade,
} from "@/lib/queries/relatorios/operacao"
import { descansosDescumpridos, jornadasLongas, painelPorMotorista } from "@/lib/services/relatorios/jornada-analise"
import {
  TOLERANCIA_SAIDA_MINUTOS,
  analisarPontualidade,
  integracoesVencendo,
  listarAvisos,
  textoVencimento,
  usoDaFrota,
  type GrupoPontualidade,
} from "@/lib/services/relatorios/operacao"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import type { OcorrenciaCircadiano } from "@/lib/services/circadiano.service"
import { aba, type Aba, type Coluna } from "@/lib/excel/planilha"
import { PERIODO_PADRAO, parseDiasIntegracao, parseHorasJornadaLonga } from "./catalogo"
import { formatarDiaCompleto, formatarDuracao, rotuloTurno } from "./formato"
import { resolverPeriodo, type Periodo, type PeriodoPadrao } from "./periodo"

// Cada aba tem seu próprio tipo de linha — `any` só junta abas diferentes num array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResultadoExportacao = { arquivo: string; abas: Array<Aba<any>> }
type Exportador = (filialId: number, params: URLSearchParams) => Promise<ResultadoExportacao | null>

const nome = (texto: string | null | undefined) => (texto ? formatarNomeProprio(texto) : "")
const atividade = (valor: "VIAGEM" | "INTERNO") => (valor === "VIAGEM" ? "Viagem" : "Interno")
const frota = (codigo: string | null) => (codigo ? formatarCodigoFrota(codigo).replace("—", "") : "")
const textoPeriodo = (periodo: Periodo) => `Período ${formatarDiaCompleto(periodo.de)} a ${formatarDiaCompleto(periodo.ate)}`

/** Colunas comuns a todo relatório de jornada: o que o motorista fazia (viagem ou interno) e com qual frota. */
function colunasAtividade<T extends { atividade: "VIAGEM" | "INTERNO"; numViagem: string | null; cavalo: string | null; carreta: string | null }>(): Coluna<T>[] {
  return [
    { titulo: "Atividade", valor: (l) => atividade(l.atividade) },
    { titulo: "Nº Viagem", valor: (l) => l.numViagem ?? "", tipo: "codigo" },
    { titulo: "Cavalo", valor: (l) => frota(l.cavalo), tipo: "codigo", largura: 9 },
    { titulo: "Carreta", valor: (l) => frota(l.carreta), tipo: "codigo", largura: 9 },
  ]
}

function periodoDaUrl(params: URLSearchParams, padrao: PeriodoPadrao): Periodo | null {
  return resolverPeriodo(params.get("de") ?? undefined, params.get("ate") ?? undefined, padrao)
}

/** Exportador que depende do período; null se o ?de/?ate for inválido. */
function comPeriodo(
  padrao: PeriodoPadrao,
  prefixo: string,
  montar: (filialId: number, periodo: Periodo, params: URLSearchParams) => Promise<ResultadoExportacao["abas"]>,
): Exportador {
  return async (filialId, params) => {
    const periodo = periodoDaUrl(params, padrao)
    if (!periodo) return null
    return { arquivo: `${prefixo}-${periodo.deTexto}-a-${periodo.ateTexto}`, abas: await montar(filialId, periodo, params) }
  }
}

function abaCircadiano(nomeAba: string, titulo: string, subtitulo: string, ocorrencias: OcorrenciaCircadiano[]) {
  return aba<OcorrenciaCircadiano>({
    nome: nomeAba,
    titulo,
    subtitulo,
    resumo: [{ rotulo: "Ocorrências", valor: ocorrencias.length }],
    linhas: ocorrencias,
    vazio: "Ninguém passou do horário do turno.",
    colunas: [
      { titulo: "Dia", valor: (o) => o.dia, tipo: "data" },
      { titulo: "Motorista", valor: (o) => nome(o.motorista) },
      { titulo: "Turno", valor: (o) => rotuloTurno(o.turno) },
      { titulo: "Início", valor: (o) => o.inicio, tipo: "dataHora" },
      { titulo: "Fim", valor: (o) => o.fim, tipo: "dataHora" },
      { titulo: "Limite", valor: (o) => o.limite, tipo: "hora" },
      { titulo: "Passou", valor: (o) => formatarDuracao(o.minutosExcedidos) },
      ...colunasAtividade<OcorrenciaCircadiano>(),
    ],
  })
}

function abaGrupoPontualidade(nomeAba: string, rotulo: string, grupos: GrupoPontualidade[], subtitulo: string, formatar = (texto: string) => texto) {
  return aba<GrupoPontualidade>({
    nome: nomeAba,
    titulo: `Pontualidade por ${rotulo.toLowerCase()}`,
    subtitulo,
    linhas: grupos,
    destaque: (g) => (g.percentualNoHorario < 0.5 ? "perigo" : g.atrasadas > 0 ? "alerta" : null),
    colunas: [
      { titulo: rotulo, valor: (g) => formatar(g.nome), largura: 34 },
      { titulo: "Saídas", valor: (g) => g.saidas, tipo: "numero", somar: true },
      { titulo: "Atrasadas", valor: (g) => g.atrasadas, tipo: "numero", somar: true },
      { titulo: "No horário", valor: (g) => g.percentualNoHorario, tipo: "percentual" },
      { titulo: "Atraso médio", valor: (g) => (g.atrasadas > 0 ? formatarDuracao(g.atrasoMedioMinutos) : "") },
    ],
  })
}

export const EXPORTADORES_RELATORIO: Record<string, Exportador> = {
  circadiano: comPeriodo(PERIODO_PADRAO.circadiano, "ciclo-circadiano", async (filialId, periodo) => {
    const relatorio = await buscarRelatorioCircadiano(filialId, periodo.de, periodo.ate)
    const regra = "Dia passa das 22:00 · Noite passa das 05:00"
    return [
      abaCircadiano("Previsto", "Ciclo circadiano · previsto (viagens agendadas)", `${textoPeriodo(periodo)} · ${regra} · jornada estimada em até 12h`, relatorio.previstas),
      abaCircadiano("Realizado", "Ciclo circadiano · realizado (relatório de jornada)", `${textoPeriodo(periodo)} · ${regra}`, relatorio.realizadas),
    ]
  }),

  "sem-folga": comPeriodo(PERIODO_PADRAO.semFolga, "dias-sem-folga", async (filialId, periodo) => {
    const registros = await buscarFolgasEstouradas(filialId, periodo.de, periodo.ate)
    type Registro = (typeof registros)[number]
    return [
      aba<Registro>({
        nome: "Dias sem folga",
        titulo: "Dias sem folga · 7º dia seguido ou mais",
        subtitulo: textoPeriodo(periodo),
        resumo: [
          { rotulo: "Ocorrências", valor: registros.length },
          { rotulo: "Motoristas", valor: new Set(registros.map((r) => r.motoristaId)).size },
        ],
        linhas: registros,
        destaque: () => "perigo",
        vazio: "Ninguém passou de 6 dias seguidos sem folga.",
        colunas: [
          { titulo: "Dia", valor: (r) => r.dia, tipo: "data" },
          { titulo: "Motorista", valor: (r) => nome(r.motorista) },
          { titulo: "Turno", valor: (r) => rotuloTurno(r.turno) },
          { titulo: "Dias sem folga", valor: (r) => r.diasSemFolga, tipo: "numero" },
          { titulo: "Início", valor: (r) => r.inicio, tipo: "dataHora" },
          { titulo: "Fim", valor: (r) => r.fim, tipo: "dataHora" },
          ...colunasAtividade<Registro>(),
        ],
      }),
    ]
  }),

  interjornada: comPeriodo(PERIODO_PADRAO.interjornada, "descanso-nao-cumprido", async (filialId, periodo) => {
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    const ocorrencias = descansosDescumpridos(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate)
    type Ocorrencia = (typeof ocorrencias)[number]
    return [
      aba<Ocorrencia>({
        nome: "Descanso não cumprido",
        titulo: "Descanso não cumprido (realizado)",
        subtitulo: `${textoPeriodo(periodo)} · mínimo de 11h, ou 35h depois do 6º dia seguido`,
        resumo: [
          { rotulo: "Interjornada (11h)", valor: ocorrencias.filter((o) => o.tipo === "INTERJORNADA").length },
          { rotulo: "Semanal (35h)", valor: ocorrencias.filter((o) => o.tipo === "SEMANAL").length },
        ],
        linhas: ocorrencias,
        destaque: (o) => (o.tipo === "SEMANAL" ? "perigo" : "alerta"),
        vazio: "Todos descansaram o mínimo.",
        colunas: [
          { titulo: "Motorista", valor: (o) => nome(o.motorista) },
          { titulo: "Turno", valor: (o) => rotuloTurno(o.turno) },
          { titulo: "Tipo", valor: (o) => (o.tipo === "SEMANAL" ? "Semanal (35h)" : "Interjornada (11h)") },
          { titulo: "Parou", valor: (o) => o.fimAnterior, tipo: "dataHora" },
          { titulo: "Voltou", valor: (o) => o.inicioSeguinte, tipo: "dataHora" },
          { titulo: "Descansou", valor: (o) => formatarDuracao(o.descansoMinutos) },
          { titulo: "Faltou", valor: (o) => formatarDuracao(o.faltaramMinutos) },
          ...colunasAtividade<Ocorrencia>(),
        ],
      }),
    ]
  }),

  "jornadas-longas": comPeriodo(PERIODO_PADRAO.jornadasLongas, "jornadas-longas", async (filialId, periodo, params) => {
    const limite = parseHorasJornadaLonga(params.get("horas"))
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    const ocorrencias = jornadasLongas(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, limite)
    type Ocorrencia = (typeof ocorrencias)[number]
    return [
      aba<Ocorrencia>({
        nome: `Acima de ${limite}h`,
        titulo: `Jornadas acima de ${limite}h`,
        subtitulo: textoPeriodo(periodo),
        resumo: [{ rotulo: "Jornadas", valor: ocorrencias.length }],
        linhas: ocorrencias,
        destaque: (o) => (o.excedenteMinutos >= 120 ? "perigo" : "alerta"),
        vazio: `Nenhuma jornada passou de ${limite}h.`,
        colunas: [
          { titulo: "Dia", valor: (o) => o.inicio, tipo: "data" },
          { titulo: "Motorista", valor: (o) => nome(o.motorista) },
          { titulo: "Turno", valor: (o) => rotuloTurno(o.turno) },
          { titulo: "Início", valor: (o) => o.inicio, tipo: "dataHora" },
          { titulo: "Fim", valor: (o) => o.fim, tipo: "dataHora" },
          { titulo: "Duração", valor: (o) => formatarDuracao(o.duracaoMinutos) },
          { titulo: "Passou", valor: (o) => formatarDuracao(o.excedenteMinutos) },
          ...colunasAtividade<Ocorrencia>(),
        ],
      }),
    ]
  }),

  motoristas: comPeriodo(PERIODO_PADRAO.motoristas, "painel-motoristas", async (filialId, periodo) => {
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    const linhas = painelPorMotorista(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate)
    type Linha = (typeof linhas)[number]
    return [
      aba<Linha>({
        nome: "Por motorista",
        titulo: "Painel por motorista",
        subtitulo: textoPeriodo(periodo),
        resumo: [
          { rotulo: "Motoristas", valor: linhas.length },
          { rotulo: "Com alerta", valor: linhas.filter((l) => l.totalAlertas > 0).length },
        ],
        linhas,
        destaque: (l) => (l.totalAlertas >= 3 ? "perigo" : l.totalAlertas > 0 ? "alerta" : l.diasTrabalhados === 0 && l.viagens === 0 ? "apagado" : null),
        colunas: [
          { titulo: "Motorista", valor: (l) => nome(l.motorista) },
          { titulo: "Turno", valor: (l) => rotuloTurno(l.turno) },
          { titulo: "Dias trabalhados", valor: (l) => l.diasTrabalhados, tipo: "numero" },
          { titulo: "Horas trabalhadas", valor: (l) => formatarDuracao(l.horasTrabalhadasMinutos) },
          { titulo: "Maior jornada", valor: (l) => formatarDuracao(l.maiorJornadaMinutos) },
          { titulo: "Viagens", valor: (l) => l.viagens, tipo: "numero", somar: true },
          { titulo: "Circadiano", valor: (l) => l.circadiano, tipo: "numero", somar: true },
          { titulo: "7º dia", valor: (l) => l.diasSemFolgaEstourados, tipo: "numero", somar: true },
          { titulo: "Descanso", valor: (l) => l.descansosDescumpridos, tipo: "numero", somar: true },
          { titulo: "Longas", valor: (l) => l.jornadasLongas, tipo: "numero", somar: true },
          { titulo: "Total de alertas", valor: (l) => l.totalAlertas, tipo: "numero", somar: true },
        ],
      }),
    ]
  }),

  integracoes: async (filialId, params) => {
    const dias = parseDiasIntegracao(params.get("dias"))
    const integracoes = integracoesVencendo(await buscarIntegracoesParaRelatorio(filialId, dias), new Date(), dias)
    type Integracao = (typeof integracoes)[number]
    return {
      arquivo: `integracoes-proximos-${dias}-dias`,
      abas: [
        aba<Integracao>({
          nome: "Integrações",
          titulo: "Integrações vencendo",
          subtitulo: `Vencidas e vencendo nos próximos ${dias} dias`,
          resumo: [
            { rotulo: "Vencidas", valor: integracoes.filter((i) => i.situacao === "VENCIDA").length },
            { rotulo: "Vencendo", valor: integracoes.filter((i) => i.situacao !== "VENCIDA").length },
          ],
          linhas: integracoes,
          destaque: (i) => (i.situacao === "VENCIDA" ? "perigo" : i.situacao === "URGENTE" ? "alerta" : null),
          vazio: "Nenhuma integração vencida ou vencendo.",
          colunas: [
            { titulo: "Motorista", valor: (i) => nome(i.motorista) },
            { titulo: "Cliente", valor: (i) => i.cliente },
            { titulo: "Validade", valor: (i) => i.dataValidade, tipo: "data" },
            { titulo: "Situação", valor: (i) => textoVencimento(i.diasParaVencer) },
            { titulo: "Status", valor: (i) => ({ ATIVO: "Ativo", INATIVO: "Inativo", PENDENTE: "Pendente" })[i.status] },
          ],
        }),
      ],
    }
  },

  pontualidade: comPeriodo(PERIODO_PADRAO.pontualidade, "pontualidade-saida", async (filialId, periodo) => {
    const resultado = analisarPontualidade(await buscarViagensPontualidade(filialId, periodo.de, periodo.ate))
    const subtitulo = `${textoPeriodo(periodo)} · até ${TOLERANCIA_SAIDA_MINUTOS} min depois do previsto conta como no horário`
    type Atraso = (typeof resultado.listaAtrasos)[number]
    type Motivo = (typeof resultado.porMotivo)[number]
    return [
      aba<Atraso>({
        nome: "Atrasos",
        titulo: "Pontualidade de saída",
        subtitulo,
        resumo: [
          { rotulo: "No horário", valor: `${Math.round(resultado.percentualNoHorario * 100)}%` },
          { rotulo: "Saídas registradas", valor: resultado.saidasRegistradas },
          { rotulo: "Atrasadas", valor: resultado.atrasadas },
          { rotulo: "Atraso médio", valor: formatarDuracao(resultado.atrasoMedioMinutos) },
          { rotulo: "Iniciadas sem saída registrada", valor: resultado.semRegistro },
        ],
        linhas: resultado.listaAtrasos,
        destaque: (a) => (a.atrasoMinutos >= 60 ? "perigo" : "alerta"),
        vazio: "Nenhuma saída atrasada no período.",
        colunas: [
          { titulo: "Dia", valor: (a) => a.previsto, tipo: "data" },
          { titulo: "Nº Viagem", valor: (a) => a.numViagem, tipo: "codigo" },
          { titulo: "Motorista", valor: (a) => nome(a.motorista) },
          { titulo: "Previsto", valor: (a) => a.previsto, tipo: "hora" },
          { titulo: "Saída real", valor: (a) => a.real, tipo: "dataHora" },
          { titulo: "Atraso", valor: (a) => formatarDuracao(a.atrasoMinutos) },
          { titulo: "Motivo", valor: (a) => a.motivo, largura: 32 },
          { titulo: "Clientes", valor: (a) => a.clientes.join(", "), largura: 36 },
        ],
      }),
      aba<Motivo>({
        nome: "Por motivo",
        titulo: "Atrasos por motivo",
        subtitulo,
        linhas: resultado.porMotivo,
        colunas: [
          { titulo: "Motivo", valor: (m) => m.motivo, largura: 40 },
          { titulo: "Atrasos", valor: (m) => m.quantidade, tipo: "numero", somar: true },
          { titulo: "Atraso médio", valor: (m) => formatarDuracao(m.atrasoMedioMinutos) },
        ],
      }),
      abaGrupoPontualidade("Por motorista", "Motorista", resultado.porMotorista, subtitulo, nome),
      abaGrupoPontualidade("Por cliente", "Cliente", resultado.porCliente, subtitulo),
    ]
  }),

  avisos: comPeriodo(PERIODO_PADRAO.avisos, "viagens-com-aviso", async (filialId, periodo) => {
    const viagens = await buscarViagensComAviso(filialId, periodo.de, periodo.ate)
    type Viagem = (typeof viagens)[number]
    return [
      aba<Viagem>({
        nome: "Viagens com aviso",
        titulo: "Viagens com aviso",
        subtitulo: textoPeriodo(periodo),
        resumo: [{ rotulo: "Viagens", valor: viagens.length }],
        linhas: viagens,
        destaque: (v) => (listarAvisos(v).length > 1 ? "perigo" : "alerta"),
        vazio: "Nenhuma viagem com aviso.",
        colunas: [
          { titulo: "Dia", valor: (v) => v.inicioPrevisto, tipo: "data" },
          { titulo: "Nº Viagem", valor: (v) => v.numViagem, tipo: "codigo" },
          { titulo: "Status", valor: (v) => formatarStatusViagem(v.status) },
          { titulo: "Motorista", valor: (v) => nome(v.motorista?.nome) },
          { titulo: "Cavalo", valor: (v) => frota(v.cavalo), tipo: "codigo", largura: 9 },
          { titulo: "Carreta", valor: (v) => frota(v.carreta), tipo: "codigo", largura: 9 },
          { titulo: "Avisos", valor: (v) => listarAvisos(v).map((a) => `${a.rotulo}: ${a.detalhe}`).join("\n"), largura: 60 },
          { titulo: "Última alteração por", valor: (v) => v.alteradoPor ?? "" },
          { titulo: "Em", valor: (v) => v.alteradoEm, tipo: "dataHora" },
        ],
      }),
    ]
  }),

  frota: comPeriodo(PERIODO_PADRAO.frota, "uso-da-frota", async (filialId, periodo) => {
    const dados = await buscarDadosUsoFrota(filialId, periodo.de, periodo.ate)
    const frotas = usoDaFrota(dados.frotas, dados.viagens, periodo.de, periodo.ate, dados.ultimaViagemPorCarreta)
    type Uso = (typeof frotas)[number]
    return [
      aba<Uso>({
        nome: "Uso da frota",
        titulo: "Uso da frota",
        subtitulo: textoPeriodo(periodo),
        resumo: [
          { rotulo: "Conjuntos", valor: frotas.length },
          { rotulo: "Parados", valor: frotas.filter((f) => f.viagens === 0 && f.diasOcupados === 0).length },
          {
            rotulo: "Ocupação média",
            valor: `${Math.round((frotas.reduce((soma, f) => soma + f.ocupacao, 0) / Math.max(frotas.length, 1)) * 100)}%`,
          },
        ],
        linhas: frotas,
        destaque: (f) => (f.viagens === 0 && f.diasOcupados === 0 ? "alerta" : null),
        colunas: [
          { titulo: "Cavalo", valor: (f) => frota(f.cavalo), tipo: "codigo" },
          { titulo: "Carreta", valor: (f) => frota(f.carreta), tipo: "codigo" },
          { titulo: "Produto", valor: (f) => (f.tipoProduto ? formatarProduto(f.tipoProduto) : "") },
          { titulo: "Viagens", valor: (f) => f.viagens, tipo: "numero", somar: true },
          { titulo: "Dias em viagem", valor: (f) => f.diasOcupados, tipo: "numero" },
          { titulo: "Ocupação", valor: (f) => f.ocupacao, tipo: "percentual" },
          { titulo: "Última viagem", valor: (f) => f.ultimaViagem, tipo: "data" },
          { titulo: "Manutenção", valor: (f) => (f.emManutencao ? "Sim" : "") },
        ],
      }),
    ]
  }),

  "nao-consta": async (filialId) => {
    const viagens = await buscarViagensNaoConstam(filialId)
    type Viagem = (typeof viagens)[number]
    return {
      arquivo: "viagens-nao-constam-no-relatorio",
      abas: [
        aba<Viagem>({
          nome: "Não constam",
          titulo: "Viagens que não constam no relatório de jornada",
          subtitulo: "Cancele ou corrija cada uma",
          resumo: [{ rotulo: "Pendentes", valor: viagens.length }],
          linhas: viagens,
          destaque: () => "alerta",
          vazio: "Nada pendente.",
          colunas: [
            { titulo: "Dia", valor: (v) => v.inicioPrevisto, tipo: "data" },
            { titulo: "Nº Viagem", valor: (v) => v.numViagem, tipo: "codigo" },
            { titulo: "Status", valor: (v) => formatarStatusViagem(v.status) },
            { titulo: "Motorista", valor: (v) => nome(v.motorista?.nome) },
            { titulo: "Início", valor: (v) => v.inicioPrevisto, tipo: "dataHora" },
            { titulo: "Fim previsto", valor: (v) => v.fimPrevisto, tipo: "dataHora" },
            { titulo: "Cavalo", valor: (v) => frota(v.cavalo), tipo: "codigo" },
            { titulo: "Carreta", valor: (v) => frota(v.carreta), tipo: "codigo" },
          ],
        }),
      ],
    }
  },
}
