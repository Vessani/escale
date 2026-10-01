import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
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
  analisarPontualidade,
  integracoesVencendo,
  listarAvisos,
  textoVencimento,
  usoDaFrota,
} from "@/lib/services/relatorios/operacao"
import type { OcorrenciaCircadiano } from "@/lib/services/circadiano.service"
import { PERIODO_PADRAO, parseDiasIntegracao, parseHorasJornadaLonga } from "./catalogo"
import { formatarDiaCompleto, formatarDuracao, formatarPercentual, rotuloTurno } from "./formato"
import { resolverPeriodo, type Periodo, type PeriodoPadrao } from "./periodo"

type Linha = Record<string, string | number>
export type ResultadoExportacao = { arquivo: string; planilhas: Array<{ nome: string; linhas: Linha[] }> }
type Exportador = (filialId: number, params: URLSearchParams) => Promise<ResultadoExportacao | null>

const nome = (texto: string) => formatarNomeProprio(texto)
const dataHora = (data: Date | null) => (data ? formatarDataHoraPtBr(data) : "")
const atividade = (valor: "VIAGEM" | "INTERNO") => (valor === "VIAGEM" ? "Viagem" : "Interno")

function periodoDaUrl(params: URLSearchParams, padrao: PeriodoPadrao): Periodo | null {
  return resolverPeriodo(params.get("de") ?? undefined, params.get("ate") ?? undefined, padrao)
}

/** Exportador que depende do período; null se o ?de/?ate for inválido. */
function comPeriodo(
  padrao: PeriodoPadrao,
  prefixo: string,
  montar: (filialId: number, periodo: Periodo, params: URLSearchParams) => Promise<ResultadoExportacao["planilhas"]>,
): Exportador {
  return async (filialId, params) => {
    const periodo = periodoDaUrl(params, padrao)
    if (!periodo) return null
    return { arquivo: `${prefixo}-${periodo.deTexto}-a-${periodo.ateTexto}`, planilhas: await montar(filialId, periodo, params) }
  }
}

function linhasCircadiano(ocorrencias: OcorrenciaCircadiano[]): Linha[] {
  return ocorrencias.map((ocorrencia) => ({
    Dia: formatarDiaCompleto(ocorrencia.dia),
    Motorista: nome(ocorrencia.motorista),
    Turno: rotuloTurno(ocorrencia.turno),
    Início: dataHora(ocorrencia.inicio),
    Fim: dataHora(ocorrencia.fim),
    Limite: dataHora(ocorrencia.limite),
    "Passou (min)": ocorrencia.minutosExcedidos,
    Atividade: atividade(ocorrencia.atividade),
    "Nº Viagem": ocorrencia.numViagem ?? "",
    Cavalo: ocorrencia.cavalo ?? "",
    Carreta: ocorrencia.carreta ?? "",
  }))
}

export const EXPORTADORES_RELATORIO: Record<string, Exportador> = {
  circadiano: comPeriodo(PERIODO_PADRAO.circadiano, "ciclo-circadiano", async (filialId, periodo) => {
    const relatorio = await buscarRelatorioCircadiano(filialId, periodo.de, periodo.ate)
    return [
      { nome: "Realizado", linhas: linhasCircadiano(relatorio.realizadas) },
      { nome: "Previsto", linhas: linhasCircadiano(relatorio.previstas) },
    ]
  }),

  "sem-folga": comPeriodo(PERIODO_PADRAO.semFolga, "dias-sem-folga", async (filialId, periodo) => {
    const registros = await buscarFolgasEstouradas(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: "Dias sem folga",
        linhas: registros.map((registro) => ({
          Dia: formatarDiaCompleto(registro.dia),
          Motorista: nome(registro.motorista),
          Turno: rotuloTurno(registro.turno),
          "Dias sem folga": registro.diasSemFolga,
          Início: dataHora(registro.inicio),
          Fim: dataHora(registro.fim),
          Atividade: atividade(registro.atividade),
          "Nº Viagem": registro.numViagem ?? "",
          Cavalo: registro.cavalo ?? "",
          Carreta: registro.carreta ?? "",
        })),
      },
    ]
  }),

  interjornada: comPeriodo(PERIODO_PADRAO.interjornada, "descanso-nao-cumprido", async (filialId, periodo) => {
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: "Descanso não cumprido",
        linhas: descansosDescumpridos(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate).map((item) => ({
          Motorista: nome(item.motorista),
          Turno: rotuloTurno(item.turno),
          Tipo: item.tipo === "SEMANAL" ? "Descanso semanal (35h)" : "Interjornada (11h)",
          "Fim da jornada anterior": dataHora(item.fimAnterior),
          "Início da seguinte": dataHora(item.inicioSeguinte),
          Descanso: formatarDuracao(item.descansoMinutos),
          "Faltaram (min)": item.faltaramMinutos,
          Atividade: atividade(item.atividade),
          "Nº Viagem": item.numViagem ?? "",
          Cavalo: item.cavalo ?? "",
          Carreta: item.carreta ?? "",
        })),
      },
    ]
  }),

  "jornadas-longas": comPeriodo(PERIODO_PADRAO.jornadasLongas, "jornadas-longas", async (filialId, periodo, params) => {
    const limite = parseHorasJornadaLonga(params.get("horas"))
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: `Acima de ${limite}h`,
        linhas: jornadasLongas(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, limite).map((item) => ({
          Dia: formatarDiaCompleto(item.inicio),
          Motorista: nome(item.motorista),
          Turno: rotuloTurno(item.turno),
          Início: dataHora(item.inicio),
          Fim: dataHora(item.fim),
          Duração: formatarDuracao(item.duracaoMinutos),
          "Passou (min)": item.excedenteMinutos,
          Atividade: atividade(item.atividade),
          "Nº Viagem": item.numViagem ?? "",
          Cavalo: item.cavalo ?? "",
          Carreta: item.carreta ?? "",
        })),
      },
    ]
  }),

  motoristas: comPeriodo(PERIODO_PADRAO.motoristas, "painel-motoristas", async (filialId, periodo) => {
    const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: "Por motorista",
        linhas: painelPorMotorista(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate).map((linha) => ({
          Motorista: nome(linha.motorista),
          Turno: rotuloTurno(linha.turno),
          "Dias trabalhados": linha.diasTrabalhados,
          "Horas trabalhadas": formatarDuracao(linha.horasTrabalhadasMinutos),
          "Maior jornada": formatarDuracao(linha.maiorJornadaMinutos),
          Viagens: linha.viagens,
          "Passou do horário (circadiano)": linha.circadiano,
          "Dias sem folga (7º+)": linha.diasSemFolgaEstourados,
          "Descanso não cumprido": linha.descansosDescumpridos,
          "Jornadas longas": linha.jornadasLongas,
          "Total de alertas": linha.totalAlertas,
        })),
      },
    ]
  }),

  integracoes: async (filialId, params) => {
    const dias = parseDiasIntegracao(params.get("dias"))
    const integracoes = integracoesVencendo(await buscarIntegracoesParaRelatorio(filialId, dias), new Date(), dias)
    return {
      arquivo: `integracoes-proximos-${dias}-dias`,
      planilhas: [
        {
          nome: "Integrações",
          linhas: integracoes.map((integracao) => ({
            Motorista: nome(integracao.motorista),
            Cliente: integracao.cliente,
            Validade: formatarDiaCompleto(integracao.dataValidade),
            Situação: textoVencimento(integracao.diasParaVencer),
            Status: integracao.status,
          })),
        },
      ],
    }
  },

  pontualidade: comPeriodo(PERIODO_PADRAO.pontualidade, "pontualidade-saida", async (filialId, periodo) => {
    const resultado = analisarPontualidade(await buscarViagensPontualidade(filialId, periodo.de, periodo.ate))
    const grupo = (rotulo: string) => (item: (typeof resultado.porMotorista)[number]) => ({
      [rotulo]: rotulo === "Motorista" ? nome(item.nome) : item.nome,
      Saídas: item.saidas,
      Atrasadas: item.atrasadas,
      "No horário": formatarPercentual(item.percentualNoHorario),
      "Atraso médio": item.atrasadas > 0 ? formatarDuracao(item.atrasoMedioMinutos) : "",
    })
    return [
      {
        nome: "Resumo",
        linhas: [
          {
            "Saídas registradas": resultado.saidasRegistradas,
            "No horário": resultado.noHorario,
            Atrasadas: resultado.atrasadas,
            "% no horário": formatarPercentual(resultado.percentualNoHorario),
            "Atraso médio": formatarDuracao(resultado.atrasoMedioMinutos),
            "Maior atraso": formatarDuracao(resultado.maiorAtrasoMinutos),
            "Iniciadas sem horário de saída": resultado.semRegistro,
          },
        ],
      },
      {
        nome: "Atrasos",
        linhas: resultado.listaAtrasos.map((atraso) => ({
          Dia: formatarDiaCompleto(atraso.previsto),
          "Nº Viagem": atraso.numViagem,
          Motorista: nome(atraso.motorista),
          Previsto: dataHora(atraso.previsto),
          "Saída real": dataHora(atraso.real),
          "Atraso (min)": atraso.atrasoMinutos,
          Motivo: atraso.motivo,
          Clientes: atraso.clientes.join(", "),
        })),
      },
      {
        nome: "Por motivo",
        linhas: resultado.porMotivo.map((item) => ({
          Motivo: item.motivo,
          Atrasos: item.quantidade,
          "Atraso médio": formatarDuracao(item.atrasoMedioMinutos),
        })),
      },
      { nome: "Por motorista", linhas: resultado.porMotorista.map(grupo("Motorista")) },
      { nome: "Por cliente", linhas: resultado.porCliente.map(grupo("Cliente")) },
    ]
  }),

  avisos: comPeriodo(PERIODO_PADRAO.avisos, "viagens-com-aviso", async (filialId, periodo) => {
    const viagens = await buscarViagensComAviso(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: "Viagens com aviso",
        linhas: viagens.map((viagem) => ({
          Dia: formatarDiaCompleto(viagem.inicioPrevisto),
          "Nº Viagem": viagem.numViagem,
          Status: formatarStatusViagem(viagem.status),
          Motorista: viagem.motorista ? nome(viagem.motorista.nome) : "",
          Cavalo: viagem.cavalo,
          Carreta: viagem.carreta,
          Avisos: listarAvisos(viagem).map((aviso) => `${aviso.rotulo}: ${aviso.detalhe}`).join(" | "),
          "Última alteração por": viagem.alteradoPor ?? "",
          "Última alteração em": dataHora(viagem.alteradoEm),
        })),
      },
    ]
  }),

  frota: comPeriodo(PERIODO_PADRAO.frota, "uso-da-frota", async (filialId, periodo) => {
    const dados = await buscarDadosUsoFrota(filialId, periodo.de, periodo.ate)
    return [
      {
        nome: "Uso da frota",
        linhas: usoDaFrota(dados.frotas, dados.viagens, periodo.de, periodo.ate, dados.ultimaViagemPorCarreta).map((frota) => ({
          Cavalo: frota.cavalo,
          Carreta: frota.carreta,
          Produto: frota.tipoProduto ? formatarProduto(frota.tipoProduto) : "",
          Viagens: frota.viagens,
          "Dias em viagem": frota.diasOcupados,
          Ocupação: formatarPercentual(frota.ocupacao),
          "Última viagem": frota.ultimaViagem ? formatarDiaCompleto(frota.ultimaViagem) : "Nunca",
          Manutenção: frota.emManutencao ? "Sim" : "",
        })),
      },
    ]
  }),

  "nao-consta": async (filialId) => {
    const viagens = await buscarViagensNaoConstam(filialId)
    return {
      arquivo: "viagens-nao-constam-no-relatorio",
      planilhas: [
        {
          nome: "Não constam",
          linhas: viagens.map((viagem) => ({
            Dia: formatarDiaCompleto(viagem.inicioPrevisto),
            "Nº Viagem": viagem.numViagem,
            Status: formatarStatusViagem(viagem.status),
            Motorista: viagem.motorista ? nome(viagem.motorista.nome) : "",
            Início: dataHora(viagem.inicioPrevisto),
            "Fim previsto": dataHora(viagem.fimPrevisto),
            Cavalo: viagem.cavalo,
            Carreta: viagem.carreta,
          })),
        },
      ],
    }
  },
}
