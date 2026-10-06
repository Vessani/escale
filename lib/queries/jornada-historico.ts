import type { Prisma, PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatDateForDateInput, inicioDoDia } from "@/lib/utils/date-format"

/**
 * Quantos dias de histórico de jornada as telas carregam por motorista.
 * Antes vinha o histórico INTEIRO (365 linhas por motorista depois de um
 * ano, 730 depois de dois...), sendo que as regras só olham os dias perto
 * da viagem/do calendário: a projeção do código de jornada precisa do
 * registro mais recente antes do dia (a "âncora"), e o descanso, do último
 * fim de jornada antes da viagem.
 *
 * 7 dias bastam: o descanso só precisa da última jornada antes da viagem, e
 * o ciclo de folga (7 dias) projeta a partir da âncora — o registro mais
 * recente antes da janela, que vem junto mesmo fora dela. Relatórios que
 * precisam de mais histórico (ex: ciclo circadiano) consultam por período.
 */
const DIAS_HISTORICO_JORNADA = 7

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Primeiro dia (coluna @db.Date) da janela de histórico que termina em `referencia`. */
export function inicioJanelaJornada(referencia: Date, dias = DIAS_HISTORICO_JORNADA): Date {
  return new Date(inicioDoDia(referencia).getTime() - dias * UM_DIA_MS)
}

/** Filtro de `registrosJornada` pra usar num include/select do Prisma — só a janela. */
export function filtroJanelaJornada(desde: Date): Prisma.RegistroJornadaWhereInput {
  return { data: { gte: desde } }
}

type RegistroJornadaLinha = { data: Date; codigo: number; fimJornada: Date | null }

type ClienteComRaw = Pick<PrismaClient, "$queryRaw"> | Prisma.TransactionClient

/**
 * O registro mais recente ANTES da janela, por motorista — a âncora que a
 * projeção usaria se não houver nenhum registro dentro da janela (ex:
 * motorista afastado há meses). Uma consulta só pra todos (DISTINCT ON,
 * usa o índice único (motoristaId, data)), em vez de trazer o histórico
 * inteiro pra achar uma linha por motorista.
 */
async function buscarAncoras(db: ClienteComRaw, motoristaIds: number[], desde: Date) {
  if (motoristaIds.length === 0) {
    return new Map<number, RegistroJornadaLinha>()
  }

  const linhas = await db.$queryRaw<Array<RegistroJornadaLinha & { motoristaId: number }>>`
    SELECT DISTINCT ON ("motoristaId") "motoristaId", "data", "codigo", "fimJornada"
    FROM "RegistroJornada"
    WHERE "motoristaId" = ANY(${motoristaIds}) AND "data" < ${formatDateForDateInput(desde)}::date
    ORDER BY "motoristaId", "data" DESC
  `

  return new Map(linhas.map(({ motoristaId, ...registro }) => [motoristaId, registro]))
}

/**
 * Completa o histórico (já carregado só com a janela, ver filtroJanelaJornada)
 * com a âncora de antes da janela, mantendo a ordem por data. O resultado
 * dá a mesma projeção e o mesmo fim de jornada anterior que o histórico
 * completo daria pra qualquer dia a partir do início da janela.
 */
export async function completarHistoricoComAncora<R extends { data: Date }, M extends { id: number; registrosJornada: R[] }>(
  motoristas: M[],
  desde: Date,
  db: ClienteComRaw = prisma,
): Promise<M[]> {
  const ancoras = await buscarAncoras(
    db,
    motoristas.map((motorista) => motorista.id),
    desde,
  )

  return motoristas.map((motorista) => {
    const ancora = ancoras.get(motorista.id)
    if (!ancora) {
      return motorista
    }
    // A âncora traz data/codigo/fimJornada — os mesmos campos que as consultas
    // selecionam (as que selecionam menos simplesmente ignoram o extra).
    return { ...motorista, registrosJornada: [ancora as unknown as R, ...motorista.registrosJornada] }
  })
}
