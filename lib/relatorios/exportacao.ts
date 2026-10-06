import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { buscarEstourosSetimoDia } from "@/lib/queries/estouro-setimo-dia"
import { carregarDadosJornada } from "@/lib/queries/relatorios/jornada"
import {
  buscarDadosDisponibilidade,
  buscarIntegracoesParaRelatorio,
  buscarViagensComAviso,
  buscarViagensPontualidade,
} from "@/lib/queries/relatorios/operacao"
import { estourosDeJornada, painelPorMotorista, quebrasDeIntersticio } from "@/lib/services/relatorios/jornada-analise"
import {
  TOLERANCIA_SAIDA_MINUTOS,
  analisarPontualidade,
  integracoesVencendo,
  listarAvisos,
  textoVencimento,
  disponibilidadeDaFrota,
  type DisponibilidadeVeiculo,
  type GrupoPontualidade,
} from "@/lib/services/relatorios/operacao"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { buscarViagensKmCustos, parseMotoristaFiltro } from "@/lib/queries/relatorios/km-custos"
import { parseFiltroRegistro, relatorioKmCustos } from "@/lib/services/relatorios/km-custos"
import { relatorioViagens, STATUS_RELATORIO_VIAGENS } from "@/lib/services/relatorios/viagens"
import { formatarReais } from "@/lib/utils/dinheiro"
import type { OcorrenciaCircadiano } from "@/lib/services/circadiano.service"
import { ROTULO_RESPONSAVEL, ROTULO_SITUACAO, ROTULO_VEICULO, descreverTipo, situacaoManutencao } from "@/lib/services/manutencao-regras"
import { aba, type AbaPronta, type Coluna } from "@/lib/excel/planilha"
import { PERIODO_PADRAO, parseDiasIntegracao, parseHorasEstouroJornada } from "./catalogo"
import { formatarDiaCompleto, formatarDuracao, rotuloTurno } from "./formato"
import { resolverPeriodo, type Periodo, type PeriodoPadrao } from "./periodo"

type ResultadoExportacao = { arquivo: string; abas: AbaPronta[] }
type Exportador = (filialId: number, params: URLSearchParams) => Promise<ResultadoExportacao | null>

const nome = (texto: string | null | undefined) => (texto ? formatarNomeProprio(texto) : "")
const atividade = (valor: "VIAGEM" | "INTERNO") => (valor === "VIAGEM" ? "Viagem" : "Interno")
const frota = (codigo: string | null) => (codigo ? formatarCodigoFrota(codigo).replace("—", "") : "")
const textoPeriodo = (periodo: Periodo) => `Período ${formatarDiaCompleto(periodo.de)} a ${formatarDiaCompleto(periodo.ate)}`

/** Colunas comuns a todo relatório de jornada: o que o motorista fazia (viagem ou interno) e com qual frota. */
function colunasAtividade<
  T extends { atividade: "VIAGEM" | "INTERNO"; numViagem: string | null; cavalo: string | null; carreta: string | null },
>(): Coluna<T>[] {
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

function abaGrupoPontualidade(
  nomeAba: string,
  rotulo: string,
  grupos: GrupoPontualidade[],
  subtitulo: string,
  formatar = (texto: string) => texto,
) {
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

const reaisExcel = (centavos: number) => (centavos ? centavos / 100 : null)

export const EXPORTADORES_RELATORIO: Record<string, Exportador> = {
  viagens: comPeriodo(PERIODO_PADRAO.viagens, "viagens", async (filialId, periodo, params) => {
    const viagens = await buscarViagensKmCustos(
      filialId,
      periodo.de,
      periodo.ate,
      parseMotoristaFiltro(params.get("motorista")),
      STATUS_RELATORIO_VIAGENS,
    )
    const { linhas, totais } = relatorioViagens(viagens)
    type Linha = (typeof linhas)[number]
    return [
      aba<Linha>({
        nome: "Viagens",
        titulo: "Viagens",
        subtitulo: `${textoPeriodo(periodo)} · todas as viagens, menos canceladas · cidades = clientes com SAP code e número white`,
        resumo: [
          { rotulo: "Viagens", valor: totais.viagens },
          { rotulo: "Km total", valor: totais.kmRodado.toLocaleString("pt-BR") },
          { rotulo: "Pedágio", valor: formatarReais(totais.pedagioCentavos) },
          { rotulo: "Pernoite", valor: formatarReais(totais.pernoiteCentavos) },
        ],
        linhas,
        vazio: "Nenhuma viagem no período.",
        colunas: [
          { titulo: "Nº Viagem", valor: (l) => l.numViagem, tipo: "codigo" },
          { titulo: "Data", valor: (l) => l.inicio, tipo: "dataHora" },
          { titulo: "Status", valor: (l) => formatarStatusViagem(l.status) },
          { titulo: "Motorista", valor: (l) => nome(l.motorista) },
          { titulo: "Produto", valor: (l) => l.produto ?? "" },
          { titulo: "Cidades", valor: (l) => l.regiao.join(" › "), tipo: "texto", largura: 40 },
          { titulo: "Km inicial", valor: (l) => l.kmInicial },
          { titulo: "Km final", valor: (l) => l.kmFinal },
          { titulo: "Km total", valor: (l) => l.kmRodado, somar: true },
          { titulo: "Pedágio (R$)", valor: (l) => reaisExcel(l.pedagioCentavos), tipo: "decimal", somar: true },
          { titulo: "Pernoite (R$)", valor: (l) => reaisExcel(l.pernoiteCentavos), tipo: "decimal", somar: true },
        ],
      }),
    ]
  }),

  "km-custos": comPeriodo(PERIODO_PADRAO.kmCustos, "km-e-custos", async (filialId, periodo, params) => {
    const registro = parseFiltroRegistro(params.get("registro"))
    const viagens = await buscarViagensKmCustos(filialId, periodo.de, periodo.ate, parseMotoristaFiltro(params.get("motorista")))
    const { linhas, totais } = relatorioKmCustos(viagens, registro)
    type Linha = (typeof linhas)[number]
    return [
      aba<Linha>({
        nome: "Km e custos",
        titulo: "Km e custos por viagem",
        subtitulo: `${textoPeriodo(periodo)} · ${registro === "todas" ? "todas as viagens que saíram" : "viagens com registro do motorista"} · região = cidades dos clientes com SAP code e número white`,
        resumo: [
          { rotulo: "Viagens", valor: totais.viagens },
          { rotulo: "Km rodado", valor: totais.kmRodado.toLocaleString("pt-BR") },
          { rotulo: "Custo total", valor: formatarReais(totais.custoCentavos) },
          { rotulo: "Custo por km", valor: totais.custoPorKmCentavos === null ? "—" : formatarReais(totais.custoPorKmCentavos) },
        ],
        linhas,
        vazio: "Nenhuma viagem no período.",
        colunas: [
          { titulo: "Nº Viagem", valor: (l) => l.numViagem, tipo: "codigo" },
          { titulo: "Status", valor: (l) => formatarStatusViagem(l.status) },
          { titulo: "Motorista", valor: (l) => nome(l.motorista) },
          { titulo: "Troca de motorista", valor: (l) => (l.teveTroca ? "sim" : ""), tipo: "texto", largura: 10 },
          { titulo: "Cavalo", valor: (l) => frota(l.cavalo), tipo: "codigo", largura: 9 },
          { titulo: "Carreta", valor: (l) => frota(l.carreta), tipo: "codigo", largura: 9 },
          { titulo: "Início", valor: (l) => l.inicio, tipo: "dataHora" },
          { titulo: "Fim", valor: (l) => l.fim, tipo: "dataHora" },
          { titulo: "Km inicial", valor: (l) => l.kmInicial },
          { titulo: "Km final", valor: (l) => l.kmFinal },
          { titulo: "Km rodado", valor: (l) => l.kmRodado, somar: true },
          { titulo: "Pedágio (R$)", valor: (l) => reaisExcel(l.pedagioCentavos), tipo: "decimal", somar: true },
          { titulo: "Pernoite (R$)", valor: (l) => reaisExcel(l.pernoiteCentavos), tipo: "decimal", somar: true },
          { titulo: "Custo total (R$)", valor: (l) => reaisExcel(l.custoCentavos), tipo: "decimal", somar: true },
          { titulo: "Região", valor: (l) => l.regiao.join(" → "), tipo: "texto", largura: 40 },
        ],
      }),
    ]
  }),

  circadiano: comPeriodo(PERIODO_PADRAO.circadiano, "ciclo-circadiano", async (filialId, periodo) => {
    const relatorio = await buscarRelatorioCircadiano(filialId, periodo.de, periodo.ate)
    const regra = "Dia (início 04:00–15:59) passa das 22:00 · Noite (início 16:00–03:59) passa das 05:00"
    return [
      abaCircadiano(
        "Previsto",
        "Ciclo circadiano · previsto (viagens agendadas)",
        `${textoPeriodo(periodo)} · ${regra} · jornada estimada em até 12h`,
        relatorio.previstas,
      ),
      abaCircadiano(
        "Realizado",
        "Ciclo circadiano · realizado (relatório de jornada)",
        `${textoPeriodo(periodo)} · ${regra}`,
        relatorio.realizadas,
      ),
    ]
  }),

  "estouro-7-dia": comPeriodo(PERIODO_PADRAO.estouroSetimoDia, "estouro-7-dia", async (filialId, periodo) => {
    const estouros = await buscarEstourosSetimoDia(filialId, periodo.de, periodo.ate)
    type Estouro = (typeof estouros)[number]
    return [
      aba<Estouro>({
        nome: "Estouro de 7º dia",
        titulo: "Estouro de 7º dia",
        subtitulo: `${textoPeriodo(periodo)} · trabalhou o 7º dia seguido, ou folgou menos de 35h depois do 6º dia`,
        resumo: [
          { rotulo: "7º dia trabalhado", valor: estouros.filter((e) => e.tipo === "SETIMO_DIA").length },
          { rotulo: "Folga menor que 35h", valor: estouros.filter((e) => e.tipo === "FOLGA_CURTA").length },
          { rotulo: "Motoristas", valor: new Set(estouros.map((e) => e.motoristaId)).size },
        ],
        linhas: estouros,
        destaque: () => "perigo",
        vazio: "Nenhum estouro de 7º dia no período.",
        colunas: [
          { titulo: "Dia", valor: (e) => e.dia, tipo: "data" },
          { titulo: "Motorista", valor: (e) => nome(e.motorista) },
          { titulo: "Turno", valor: (e) => rotuloTurno(e.turno) },
          { titulo: "Ocorrência", valor: (e) => (e.tipo === "SETIMO_DIA" ? `${e.diasSemFolga}º dia seguido` : "Folga menor que 35h") },
          { titulo: "Parou (6º dia)", valor: (e) => e.fimAnterior, tipo: "dataHora" },
          { titulo: "Folgou", valor: (e) => (e.folgaMinutos === null ? "" : formatarDuracao(e.folgaMinutos)) },
          { titulo: "Faltou", valor: (e) => (e.faltaramMinutos === null ? "" : formatarDuracao(e.faltaramMinutos)) },
          { titulo: "Início", valor: (e) => e.inicio, tipo: "dataHora" },
          { titulo: "Fim", valor: (e) => e.fim, tipo: "dataHora" },
          ...colunasAtividade<Estouro>(),
        ],
      }),
    ]
  }),

  "quebra-intersticio": comPeriodo(PERIODO_PADRAO.quebraIntersticio, "quebra-intersticio", async (filialId, periodo) => {
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    const ocorrencias = quebrasDeIntersticio(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate)
    type Ocorrencia = (typeof ocorrencias)[number]
    return [
      aba<Ocorrencia>({
        nome: "Quebra de interstício",
        titulo: "Quebra de interstício (realizado)",
        subtitulo: `${textoPeriodo(periodo)} · descanso menor que 11h entre jornadas`,
        resumo: [
          { rotulo: "Quebras", valor: ocorrencias.length },
          { rotulo: "Motoristas", valor: new Set(ocorrencias.map((o) => o.motoristaId)).size },
        ],
        linhas: ocorrencias,
        destaque: (o) => (o.faltaramMinutos >= 120 ? "perigo" : "alerta"),
        vazio: "Todos descansaram as 11h.",
        colunas: [
          { titulo: "Dia", valor: (o) => o.inicioSeguinte, tipo: "data" },
          { titulo: "Motorista", valor: (o) => nome(o.motorista) },
          { titulo: "Turno", valor: (o) => rotuloTurno(o.turno) },
          { titulo: "Parou", valor: (o) => o.fimAnterior, tipo: "dataHora" },
          { titulo: "Voltou", valor: (o) => o.inicioSeguinte, tipo: "dataHora" },
          { titulo: "Descansou", valor: (o) => formatarDuracao(o.descansoMinutos) },
          { titulo: "Faltou", valor: (o) => formatarDuracao(o.faltaramMinutos) },
          ...colunasAtividade<Ocorrencia>(),
        ],
      }),
    ]
  }),

  "estouro-jornada": comPeriodo(PERIODO_PADRAO.estouroJornada, "estouro-jornada", async (filialId, periodo, params) => {
    const limite = parseHorasEstouroJornada(params.get("horas"))
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    const ocorrencias = estourosDeJornada(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, limite)
    type Ocorrencia = (typeof ocorrencias)[number]
    return [
      aba<Ocorrencia>({
        nome: `Acima de ${limite}h`,
        titulo: `Estouro de jornada · acima de ${limite}h`,
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
        destaque: (l) =>
          l.totalAlertas >= 3 ? "perigo" : l.totalAlertas > 0 ? "alerta" : l.diasTrabalhados === 0 && l.viagens === 0 ? "apagado" : null,
        colunas: [
          { titulo: "Motorista", valor: (l) => nome(l.motorista) },
          { titulo: "Turno", valor: (l) => rotuloTurno(l.turno) },
          { titulo: "Dias trabalhados", valor: (l) => l.diasTrabalhados, tipo: "numero" },
          { titulo: "Horas trabalhadas", valor: (l) => formatarDuracao(l.horasTrabalhadasMinutos) },
          { titulo: "Maior jornada", valor: (l) => formatarDuracao(l.maiorJornadaMinutos) },
          { titulo: "Viagens", valor: (l) => l.viagens, tipo: "numero", somar: true },
          { titulo: "Circadiano", valor: (l) => l.circadiano, tipo: "numero", somar: true },
          { titulo: "Estouro 7º dia", valor: (l) => l.estourosSetimoDia, tipo: "numero", somar: true },
          { titulo: "Quebra interstício", valor: (l) => l.quebrasIntersticio, tipo: "numero", somar: true },
          { titulo: "Estouro jornada", valor: (l) => l.estourosJornada, tipo: "numero", somar: true },
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
          {
            titulo: "Avisos",
            valor: (v) =>
              listarAvisos(v)
                .map((a) => `${a.rotulo}: ${a.detalhe}`)
                .join("\n"),
            largura: 60,
          },
          { titulo: "Última alteração por", valor: (v) => v.alteradoPor ?? "" },
          { titulo: "Em", valor: (v) => v.alteradoEm, tipo: "dataHora" },
        ],
      }),
    ]
  }),

  frota: comPeriodo(PERIODO_PADRAO.frota, "disponibilidade-da-frota", async (filialId, periodo) => {
    const dados = await buscarDadosDisponibilidade(filialId, periodo.de, periodo.ate)
    const itens = disponibilidadeDaFrota(
      dados.veiculos,
      dados.viagens,
      dados.manutencoes,
      periodo.de,
      periodo.ate,
      new Date(),
      dados.ultimaViagemPorVeiculo,
    )
    const horas = (minutos: number) => Math.round((minutos / 60) * 10) / 10
    const abaDe = (veiculo: "CARRETA" | "CAVALO", nomeAba: string) => {
      const lista = itens.filter((item) => item.veiculo === veiculo)
      const mediaDisponibilidade = lista.length ? lista.reduce((soma, item) => soma + item.disponibilidade, 0) / lista.length : 0
      return aba<DisponibilidadeVeiculo>({
        nome: nomeAba,
        titulo: `Disponibilidade da frota · ${nomeAba.toLowerCase()}`,
        subtitulo: `${textoPeriodo(periodo)} · horas contadas até o momento da geração`,
        resumo: [
          { rotulo: "Veículos", valor: lista.length },
          { rotulo: "Disponibilidade média", valor: `${Math.round(mediaDisponibilidade * 100)}%` },
          { rotulo: "Horas paradas White Martins", valor: horas(lista.reduce((soma, i) => soma + i.minutosManutencaoWhiteMartins, 0)) },
          { rotulo: "Horas paradas Ritmo", valor: horas(lista.reduce((soma, i) => soma + i.minutosManutencaoRitmo, 0)) },
        ],
        linhas: lista,
        destaque: (item) => (item.disponibilidade < 0.8 ? "perigo" : item.disponibilidade < 0.95 ? "alerta" : null),
        colunas: [
          { titulo: veiculo === "CARRETA" ? "Carreta" : "Cavalo", valor: (i) => i.codigo, tipo: "codigo" },
          { titulo: "Conjunto", valor: (i) => i.conjunto ?? "", tipo: "codigo" },
          { titulo: "Horas no período", valor: (i) => horas(i.minutosPeriodo), tipo: "decimal" },
          { titulo: "Horas em rota", valor: (i) => horas(i.minutosEmRota), tipo: "decimal", somar: true },
          { titulo: "Horas manut. White Martins", valor: (i) => horas(i.minutosManutencaoWhiteMartins), tipo: "decimal", somar: true },
          { titulo: "Horas manut. Ritmo", valor: (i) => horas(i.minutosManutencaoRitmo), tipo: "decimal", somar: true },
          { titulo: "Horas disponível sem uso", valor: (i) => horas(i.minutosDisponivelParado), tipo: "decimal", somar: true },
          { titulo: "Disponibilidade", valor: (i) => i.disponibilidade, tipo: "percentual" },
          { titulo: "Utilização", valor: (i) => i.utilizacao, tipo: "percentual" },
          { titulo: "Manutenções", valor: (i) => i.manutencoes, tipo: "numero", somar: true },
          { titulo: "Viagens", valor: (i) => i.viagens, tipo: "numero", somar: true },
          { titulo: "Última viagem", valor: (i) => i.ultimaViagem, tipo: "data" },
        ],
      })
    }
    const manutencoes = dados.manutencoes
    type Manut = (typeof manutencoes)[number]
    const agora = new Date()
    return [
      abaDe("CARRETA", "Carretas"),
      abaDe("CAVALO", "Cavalos"),
      aba<Manut>({
        nome: "Manutenções",
        titulo: "Manutenções no período",
        subtitulo: textoPeriodo(periodo),
        resumo: [{ rotulo: "Manutenções", valor: manutencoes.length }],
        linhas: [...manutencoes].sort((a, b) => a.inicioPrevisto.getTime() - b.inicioPrevisto.getTime()),
        grupo: (m) => ROTULO_RESPONSAVEL[m.responsavel],
        destaque: (m) => (situacaoManutencao(m, agora) === "ATRASADA" ? "perigo" : null),
        vazio: "Nenhuma manutenção no período.",
        colunas: [
          { titulo: "Veículo", valor: (m) => ROTULO_VEICULO[m.veiculo] },
          { titulo: "Código", valor: (m) => m.codigo, tipo: "codigo" },
          { titulo: "Tipo", valor: (m) => descreverTipo(m) },
          { titulo: "Situação", valor: (m) => ROTULO_SITUACAO[situacaoManutencao(m, agora)] },
          { titulo: "Início previsto", valor: (m) => m.inicioPrevisto, tipo: "dataHora" },
          { titulo: "Fim previsto", valor: (m) => m.fimPrevisto, tipo: "dataHora" },
          { titulo: "Início real", valor: (m) => m.inicioReal, tipo: "dataHora" },
          { titulo: "Fim real", valor: (m) => m.fimReal, tipo: "dataHora" },
          {
            titulo: "Horas parado",
            valor: (m) => {
              const fim = m.fimReal ?? agora
              const inicio = m.inicioReal ?? m.inicioPrevisto
              return fim > inicio ? horas((fim.getTime() - inicio.getTime()) / 60_000) : 0
            },
            tipo: "decimal",
            somar: true,
          },
          { titulo: "Descrição", valor: (m) => m.descricao ?? "", largura: 50 },
        ],
      }),
    ]
  }),
}
