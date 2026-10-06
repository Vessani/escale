import { prisma } from "@/lib/prisma"
import type { Prisma, StatusViagem } from "@prisma/client"
import type { EditarViagemInput } from "@/lib/types/types"
import { ErroDeDominio, StatusViagemObrigatorioError, ViagemNaoEncontradaError } from "@/lib/errors"
import { calcularDiasEntre } from "@/lib/utils/date-format"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service"
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "./frota.service"
import { recalcularAvisosInterjornada } from "./interjornada.service"
import { turnoPorHorario } from "./turno"
import { calcularCanceladoEm, calcularFinalizadoEm, normalizarStatusPorAlocacao } from "./viagem-regras"

/**
 * Andamento da viagem depois de criada: mudança de status (despacho ou
 * motorista) e saída real. Criação e edição ficam em viagem.service.ts.
 */

/** Nova data de início/fim exigida só quando o status vai para POSTERGADA — ver atualizarStatusViagemService. */
type NovaDataViagem = { inicioPrevisto: Date; fimPrevisto: Date }

/**
 * Mudança de status feita pelo próprio motorista (celular): só grava se, NO
 * MOMENTO da escrita, a viagem ainda for dele e estiver num dos status
 * esperados — se o despacho cancelou, postergou, trocou o motorista ou
 * excluiu nesse meio-tempo, nada é gravado e sai VIAGEM_MUDOU.
 */
type CondicaoDoMotorista = {
  motoristaId: number
  statusEsperados: StatusViagem[]
  /** Gravado junto, na mesma escrita (km, saída real, motivo). */
  dados: Prisma.ViagemUpdateManyMutationInput
}

export const CODIGO_VIAGEM_MUDOU = "VIAGEM_MUDOU"

export async function atualizarStatusViagemService(
  filialId: number,
  idViagem: number,
  status: EditarViagemInput["status"],
  ator: Ator | null,
  novaData?: NovaDataViagem,
  condicao?: CondicaoDoMotorista,
) {
  if (!status) {
    throw new StatusViagemObrigatorioError()
  }

  return await prisma.$transaction(async (tx) => {
  // Linha completa e travada — vira o snapshot "antes" da auditoria, e
  // ninguém muda a viagem entre a leitura e a gravação.
  await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${idViagem} AND "filialId" = ${filialId} FOR UPDATE`
  const viagemAtual = await tx.viagem.findUnique({
    where: { id: idViagem, filialId },
  })

  if (!viagemAtual) {
    throw new ViagemNaoEncontradaError()
  }

  // Postergar muda a data — os avisos de frota gravados na criação/última
  // edição são recalculados pra essa data nova, senão ficam "presos" no valor
  // de quando a viagem foi criada/editada pela última vez (ex: aviso de frota
  // indisponível que não valia mais pro horário novo). O de interjornada é
  // recalculado dentro da transação, pra qualquer mudança de status.
  const avisosRecalculados = novaData
    ? {
        avisoFrotaIndisponivel: await calcularAvisoFrotaIndisponivel(
          filialId,
          viagemAtual.cavalo,
          viagemAtual.carreta,
          novaData.inicioPrevisto,
          novaData.fimPrevisto,
          idViagem,
        ),
        avisoFrotaProdutoIncompativel: await calcularAvisoFrotaProduto(filialId, viagemAtual.cavalo, viagemAtual.carreta, viagemAtual.produto),
      }
    : {}

  const statusFinal = normalizarStatusPorAlocacao(status, viagemAtual.motoristaId)

    const dados = {
      status: statusFinal,
      canceladoEm: calcularCanceladoEm(statusFinal, viagemAtual.status),
      finalizadoEm: calcularFinalizadoEm(statusFinal, viagemAtual.status),
      ...(novaData ? {
        inicioPrevisto: novaData.inicioPrevisto,
        fimPrevisto: novaData.fimPrevisto,
        diasViagem: calcularDiasEntre(novaData.inicioPrevisto, novaData.fimPrevisto),
        // Postergar da noite pro dia (ou o contrário) troca o turno — senão a
        // alocação procura motorista do turno errado.
        turno: turnoPorHorario(novaData.inicioPrevisto) ?? viagemAtual.turno,
      } : {}),
      ...avisosRecalculados,
    }
    let viagemAtualizada
    if (condicao) {
      const { count } = await tx.viagem.updateMany({
        where: {
          id: idViagem,
          filialId,
          deletadoEm: null,
          motoristaId: condicao.motoristaId,
          status: { in: condicao.statusEsperados },
        },
        data: { ...dados, ...condicao.dados },
      })
      if (count === 0) throw new ErroDeDominio(CODIGO_VIAGEM_MUDOU, "A viagem foi alterada pelo escalador. Atualize a tela.")
      viagemAtualizada = await tx.viagem.findUniqueOrThrow({ where: { id: idViagem } })
    } else {
      viagemAtualizada = await tx.viagem.update({ where: { id: idViagem, filialId }, data: dados })
    }

    // Cancelar/finalizar (ou postergar a data) muda se essa viagem ainda
    // "segura" a frota — sincroniza sempre, não só quando novaData é enviado.
    await sincronizarDisponibilidadeFrota(tx, filialId, viagemAtualizada.cavalo, viagemAtualizada.carreta)
    await reconciliarFolgaMotoristasNoDiaAtual(
      tx,
      [viagemAtualizada.motoristaId, viagemAtualizada.motoristaAcompanhanteId],
      [
        { inicioPrevisto: viagemAtual.inicioPrevisto, fimPrevisto: viagemAtual.fimPrevisto },
        { inicioPrevisto: viagemAtualizada.inicioPrevisto, fimPrevisto: viagemAtualizada.fimPrevisto },
      ],
    )
    // Finalizar libera o motorista: a próxima viagem dele perde o aviso de
    // descanso se, contando da finalização, as 11h/35h já estão cumpridas.
    await recalcularAvisosInterjornada(tx, filialId, [viagemAtualizada.motoristaId, viagemAtualizada.motoristaAcompanhanteId])
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAtual,
      depois: viagemAtualizada,
      ator,
      filialId,
    })
    return viagemAtualizada
  })
}

/** Registro operacional feito pelo dashboard: horário real de saída e motivo do atraso, se houver. */
export async function atualizarSaidaRealService(
  filialId: number,
  idViagem: number,
  horarioRealSaida: Date | null,
  motivoAtraso: string | null,
  ator: Ator | null,
) {
  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${idViagem} AND "filialId" = ${filialId} FOR UPDATE`
    const viagemAntes = await tx.viagem.findUniqueOrThrow({ where: { id: idViagem, filialId } })
    const viagemDepois = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: { horarioRealSaida, motivoAtraso },
    })
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAntes,
      depois: viagemDepois,
      ator,
      filialId,
    })
    return viagemDepois
  })
}