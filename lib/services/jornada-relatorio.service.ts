import { prisma } from "@/lib/prisma"
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import { MAX_DIAS_CONSECUTIVOS } from "./alocacao.service"
import { registrarJornadaNoDia } from "./motorista.service"

export type ResultadoImportacaoJornada = {
  atualizados: number
  naoEncontrados: number[]
  duplicados: number[]
}

/** Códigos de status especial (Férias/Exames/Interno) que o import não deve sobrescrever — só edição manual muda isso. */
const CODIGO_STATUS_ESPECIAL_MIN = 8
const CODIGO_STATUS_ESPECIAL_MAX = 10

function motoristaEmStatusEspecial(diasTrabalhados: number) {
  return diasTrabalhados >= CODIGO_STATUS_ESPECIAL_MIN && diasTrabalhados <= CODIGO_STATUS_ESPECIAL_MAX
}

/**
 * "Dias Sem Folga" vira o código de jornada do dia — capado em
 * MAX_DIAS_CONSECUTIVOS (6): o relatório conta dias corridos sem descanso e
 * pode passar de 6 (ex: 7 = trabalhou o 7º dia seguido), mas nosso código 7
 * significa Folga — gravar o valor bruto marcaria "Folga" pra quem está
 * trabalhando, o oposto do que o relatório diz.
 */
function calcularCodigoDoDiasSemFolga(diasSemFolga: number) {
  return Math.max(1, Math.min(diasSemFolga, MAX_DIAS_CONSECUTIVOS))
}

/**
 * Grava, pra cada matrícula do relatório, o último registro de jornada
 * (início, fim, dia) no motorista correspondente (busca por `seva`) e usa
 * "Dias Sem Folga" pra atualizar o código de jornada do dia — essa é agora a
 * fonte principal do controle de dias trabalhados; o preenchimento manual no
 * calendário fica só pra emergência. Motoristas manualmente marcados como
 * Férias/Exames/Interno (código 8-10) não têm o código sobrescrito pelo
 * import, só o registro de horário — evita tirar alguém de licença sozinho.
 * Matrículas sem motorista correspondente, ou com mais de um (seva
 * duplicado), são reportadas em vez de derrubar o import inteiro.
 */
export async function atualizarJornadaRelatorioDosMotoristas(
  registros: RegistroJornadaRelatorio[],
): Promise<ResultadoImportacaoJornada> {
  let atualizados = 0
  const naoEncontrados: number[] = []
  const duplicados: number[] = []

  for (const registro of registros) {
    const motoristas = await prisma.motorista.findMany({
      where: { seva: registro.matricula, deletadoEm: null },
      select: { id: true, diasTrabalhados: true },
    })

    if (motoristas.length === 0) {
      naoEncontrados.push(registro.matricula)
      continue
    }

    if (motoristas.length > 1) {
      duplicados.push(registro.matricula)
      continue
    }

    const motorista = motoristas[0]

    await prisma.$transaction(async (tx) => {
      await tx.motorista.update({
        where: { id: motorista.id },
        data: {
          jornadaRelatorioInicio: new Date(registro.inicioJornada),
          jornadaRelatorioFim: new Date(registro.fimJornada),
          jornadaRelatorioDia: new Date(registro.dia),
        },
      })

      if (!motoristaEmStatusEspecial(motorista.diasTrabalhados)) {
        const codigo = calcularCodigoDoDiasSemFolga(registro.diasSemFolga)
        await registrarJornadaNoDia(tx, motorista.id, new Date(registro.dia), codigo)
      }
    })

    atualizados++
  }

  return { atualizados, naoEncontrados, duplicados }
}
