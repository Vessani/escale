import type { Prisma, VeiculoManutencao } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { converterEntradaDeDataHora } from "@/lib/utils/date-format"
import { ManutencaoNaoEncontradaError, ManutencaoPeriodoInvalidoError } from "@/lib/errors"
import type { ManutencaoDados } from "@/lib/validation/manutencoes"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import { sincronizarDisponibilidadeFrota } from "./frota.service"

/**
 * Agendar, ajustar, iniciar, concluir e excluir manutenções. Toda gravação
 * recalcula, na mesma transação, o aviso de frota indisponível das viagens
 * em aberto que usam o veículo — senão a viagem já alocada pra carreta que
 * entrou em manutenção (ou saiu dela) ficaria com o aviso antigo.
 */

type Veiculo = { veiculo: VeiculoManutencao; codigo: string }

function dadosParaBanco(dados: ManutencaoDados) {
  return {
    veiculo: dados.veiculo,
    codigo: dados.codigo.trim().toUpperCase(),
    tipo: dados.tipo,
    nivel: dados.tipo === "PREVENTIVA" ? dados.nivel : null,
    responsavel: dados.responsavel,
    descricao: dados.descricao?.trim() || null,
    inicioPrevisto: converterEntradaDeDataHora(dados.inicioPrevisto),
    fimPrevisto: dados.fimPrevisto ? converterEntradaDeDataHora(dados.fimPrevisto) : null,
  }
}

/**
 * Recalcula o aviso das viagens em aberto que usam algum dos veículos. O
 * aviso é por carreta (ver sincronizarDisponibilidadeFrota), então junta as
 * carretas dessas viagens — inclusive as puxadas por um cavalo em manutenção.
 */
async function recalcularViagensDosVeiculos(tx: Prisma.TransactionClient, filialId: number, veiculos: Veiculo[]) {
  const cavalos = veiculos.filter((v) => v.veiculo === "CAVALO").map((v) => v.codigo)
  const carretas = veiculos.filter((v) => v.veiculo === "CARRETA").map((v) => v.codigo)

  const viagens = await tx.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      status: { notIn: ["CANCELADA", "FINALIZADA"] },
      OR: [
        ...(cavalos.length ? [{ cavalo: { in: cavalos } }] : []),
        ...(carretas.length ? [{ carreta: { in: carretas } }] : []),
      ],
    },
    select: { cavalo: true, carreta: true },
  })

  const porCarreta = new Map<string, string>()
  for (const viagem of viagens) porCarreta.set(viagem.carreta, viagem.cavalo)
  for (const [carreta, cavalo] of porCarreta) {
    await sincronizarDisponibilidadeFrota(tx, filialId, cavalo, carreta)
  }
}

async function buscarOuFalhar(filialId: number, id: number) {
  const manutencao = await prisma.manutencao.findFirst({ where: { id, filialId, deletadoEm: null } })
  if (!manutencao) throw new ManutencaoNaoEncontradaError()
  return manutencao
}

export async function criarManutencaoService(filialId: number, dados: ManutencaoDados, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const criada = await tx.manutencao.create({ data: { ...dadosParaBanco(dados), filialId } })
    await recalcularViagensDosVeiculos(tx, filialId, [criada])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: criada.id, acao: "CRIACAO", depois: criada, ator, filialId })
    return criada
  })
}

export async function editarManutencaoService(filialId: number, id: number, dados: ManutencaoDados, ator: Ator | null) {
  const antes = await buscarOuFalhar(filialId, id)
  const novos = dadosParaBanco(dados)

  return prisma.$transaction(async (tx) => {
    const depois = await tx.manutencao.update({ where: { id }, data: novos })
    // Trocar o veículo libera o antigo: recalcula os dois.
    await recalcularViagensDosVeiculos(tx, filialId, [antes, depois])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: id, acao: "ATUALIZACAO", antes, depois, ator, filialId })
    return depois
  })
}

/** Registra o início real (padrão: agora). */
export async function iniciarManutencaoService(filialId: number, id: number, quando: Date, ator: Ator | null) {
  const antes = await buscarOuFalhar(filialId, id)
  if (antes.fimReal) throw new ManutencaoPeriodoInvalidoError("Essa manutenção já foi concluída.")

  return prisma.$transaction(async (tx) => {
    const depois = await tx.manutencao.update({ where: { id }, data: { inicioReal: quando } })
    await recalcularViagensDosVeiculos(tx, filialId, [depois])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: id, acao: "ATUALIZACAO", antes, depois, ator, filialId })
    return depois
  })
}

/**
 * Registra o fim real — o veículo volta a ficar disponível a partir daí.
 * Sem início real registrado, assume que começou no previsto (ou em
 * `quando`, se ele for antes disso).
 */
export async function concluirManutencaoService(filialId: number, id: number, quando: Date, ator: Ator | null) {
  const antes = await buscarOuFalhar(filialId, id)
  const inicio = antes.inicioReal ?? (antes.inicioPrevisto < quando ? antes.inicioPrevisto : quando)
  if (quando < inicio) throw new ManutencaoPeriodoInvalidoError("O fim real precisa ser depois do início.")

  return prisma.$transaction(async (tx) => {
    const depois = await tx.manutencao.update({ where: { id }, data: { inicioReal: inicio, fimReal: quando } })
    await recalcularViagensDosVeiculos(tx, filialId, [depois])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: id, acao: "ATUALIZACAO", antes, depois, ator, filialId })
    return depois
  })
}

/** Desfaz a conclusão (concluiu por engano): volta a ficar em andamento. */
export async function reabrirManutencaoService(filialId: number, id: number, ator: Ator | null) {
  const antes = await buscarOuFalhar(filialId, id)

  return prisma.$transaction(async (tx) => {
    const depois = await tx.manutencao.update({ where: { id }, data: { fimReal: null } })
    await recalcularViagensDosVeiculos(tx, filialId, [depois])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: id, acao: "ATUALIZACAO", antes, depois, ator, filialId })
    return depois
  })
}

export async function excluirManutencaoService(filialId: number, id: number, ator: Ator | null) {
  const antes = await buscarOuFalhar(filialId, id)

  return prisma.$transaction(async (tx) => {
    const depois = await tx.manutencao.update({ where: { id }, data: { deletadoEm: new Date() } })
    await recalcularViagensDosVeiculos(tx, filialId, [antes])
    await registrarAuditoria(tx, { entidade: "Manutencao", entidadeId: id, acao: "EXCLUSAO", antes, depois, ator, filialId })
    return depois
  })
}
