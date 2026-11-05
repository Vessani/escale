import { encontrarJornadaAnterior } from "../jornada.service"
import { descansoMinimoNecessarioApos, fimEfetivoViagem, viagemBloqueiaAgenda, viagemDesmentidaPeloRelatorio } from "./disponibilidade"
import type { MotoristaParaAlocacao, ViagemParaDisponibilidade } from "./tipos"

/**
 * Motorista com o que a regra de descanso precisa. `viagens` é opcional:
 * sem agenda carregada, só o relatório de jornada conta.
 */
export type MotoristaParaDescanso = Pick<MotoristaParaAlocacao, "registrosJornada" | "relatorioJornadaAte"> & {
  viagens?: ViagemParaDisponibilidade[]
}

type DescansoAntesDaViagem = {
  /** Quando o motorista parou de trabalhar pela última vez antes da viagem (ver encontrarTrabalhoAnterior). */
  fimTrabalhoAnterior: Date
  /** 11h de interjornada, ou 35h de descanso semanal depois do 6º dia (ver descansoMinimoNecessarioApos). */
  minimoHoras: number
  /** fimTrabalhoAnterior + minimoHoras — antes disso o motorista não pode iniciar a viagem. */
  inicioPermitido: Date
}

type TrabalhoAnterior = { inicio: Date; fim: Date }

/**
 * Quando o motorista parou de trabalhar pela última vez antes de `inicioViagem`
 * (e quando aquele trabalho começou — no relatório, o dia da jornada):
 * o mais tarde entre o fim de jornada do relatório importado (dado real do
 * rastreador) e o fim efetivo das viagens dele que começaram antes — viagem
 * finalizada conta a partir da finalização (ver fimEfetivoViagem), as demais
 * pelo fim previsto. `viagemId` é a própria viagem avaliada, ignorada na
 * agenda (ausente pra uma viagem ainda não gravada). Viagem que o relatório
 * desmente (dias cobertos por ele sem o motorista trabalhar) não conta — o
 * relatório prevalece, ver viagemDesmentidaPeloRelatorio.
 */
function encontrarTrabalhoAnterior(motorista: MotoristaParaDescanso, inicioViagem: Date, viagemId?: number): TrabalhoAnterior | null {
  const jornada = encontrarJornadaAnterior(motorista.registrosJornada, inicioViagem)
  let maisRecente: TrabalhoAnterior | null = jornada && { inicio: jornada.dia, fim: jornada.fim }

  for (const viagem of motorista.viagens ?? []) {
    if (viagem.id === viagemId || !viagemBloqueiaAgenda(viagem)) continue
    if (new Date(viagem.inicioPrevisto) >= inicioViagem) continue
    if (viagemDesmentidaPeloRelatorio(motorista, viagem)) continue

    const fim = fimEfetivoViagem(viagem)
    if (!maisRecente || fim > maisRecente.fim) {
      maisRecente = { inicio: new Date(viagem.inicioPrevisto), fim }
    }
  }

  return maisRecente
}

/**
 * REGRA ÚNICA de descanso antes de uma viagem. Antes ela existia em quatro
 * variações que discordavam entre si:
 * - o aviso gravado na viagem olhava relatório + viagens do Escale;
 * - a ordenação da sugestão (priorizacao.ts) olhava só o relatório;
 * - o "libera às" mostrado na tela de alocação decidia 11h/35h pelo código
 *   de HOJE, não pelo do dia em que o motorista parou.
 * Resultado: a sugestão podia indicar um motorista e, ao gravar, a viagem
 * ganhar aviso de interjornada. Agora aviso, ordenação e tela usam esta
 * função. `null` = sem nenhum trabalho anterior conhecido.
 *
 * O bloqueio rígido de conflito de agenda entre viagens do Escale
 * (motoristaEstaDisponivelNoPeriodo) continua separado porque olha os dois
 * sentidos (a viagem nova também não pode encurtar o descanso ANTES de uma
 * viagem já agendada depois dela) — mas usa as mesmas peças: fimEfetivoViagem
 * e descansoMinimoNecessarioApos.
 */
export function calcularDescansoAntesDaViagem(
  motorista: MotoristaParaDescanso,
  inicioViagem: Date,
  hoje: Date,
  viagemId?: number,
): DescansoAntesDaViagem | null {
  const trabalhoAnterior = encontrarTrabalhoAnterior(motorista, inicioViagem, viagemId)

  if (!trabalhoAnterior) {
    return null
  }

  const { inicio, fim: fimTrabalhoAnterior } = trabalhoAnterior
  const minimoHoras = descansoMinimoNecessarioApos(motorista, inicio, fimTrabalhoAnterior, hoje)

  return {
    fimTrabalhoAnterior,
    minimoHoras,
    inicioPermitido: new Date(fimTrabalhoAnterior.getTime() + minimoHoras * 60 * 60 * 1000),
  }
}
