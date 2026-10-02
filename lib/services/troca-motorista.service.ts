import { prisma } from "@/lib/prisma"
import { ErroDeDominio, ViagemNaoEncontradaError } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import { recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { validarHoraDoRegistro, validarKmDoRegistro } from "@/lib/services/limites-registro"
import { CODIGO_VIAGEM_MUDOU, garantirMotoristasValidos } from "@/lib/services/viagem.service"
import { podeSerPrincipal } from "@/lib/services/tipo-motorista"
import { motoristaAutorizadoParaProduto } from "@/lib/services/alocacao/compatibilidade"
import type { TipoProduto } from "@prisma/client"
import { TAMANHO_MAXIMO_LOCAL, TAMANHO_MAXIMO_MOTIVO_TROCA } from "@/lib/validation/troca-motorista"

/**
 * Troca de motorista no meio da viagem: o substituto assume (a viagem passa
 * pro acesso dele, que continua registrando pelo celular) e fica gravado
 * quem entregou, onde, quando, com quantos km e por quê.
 *
 * Pode ser feita pelo escalador ou pelo próprio motorista que está com a
 * viagem (`exigirMotoristaAtual`). Só com a viagem em andamento — antes de
 * sair é só realocar na Gestão de Viagens.
 */


type DadosTroca = {
  motoristaNovoId: number
  km: number
  trocadoEm: Date
  local: string
  motivo: string
}

export async function trocarMotoristaDaViagem(
  filialId: number,
  viagemId: number,
  dados: DadosTroca,
  ator: Ator,
  opcoes: { exigirMotoristaAtual?: number } = {},
  agora = new Date(),
) {
  const viagem = await prisma.viagem.findFirst({
    where: {
      id: viagemId,
      filialId,
      deletadoEm: null,
      ...(opcoes.exigirMotoristaAtual ? { motoristaId: opcoes.exigirMotoristaAtual } : {}),
    },
  })
  if (!viagem) throw new ViagemNaoEncontradaError()
  if (!STATUS_EM_ANDAMENTO.includes(viagem.status)) {
    throw new ErroDeDominio("TROCA_SO_EM_ANDAMENTO", "A troca de motorista é pra viagem em andamento. Antes de sair, é só realocar na Gestão de Viagens.")
  }
  const anteriorId = viagem.motoristaId
  if (!anteriorId) throw new ErroDeDominio("VIAGEM_SEM_MOTORISTA", "A viagem está sem motorista.")
  if (dados.motoristaNovoId === anteriorId) throw new ErroDeDominio("MESMO_MOTORISTA", "Escolha um motorista diferente do atual.")

  const novo = await prisma.motorista.findFirst({
    where: { id: dados.motoristaNovoId, filialId, deletadoEm: null },
    select: { id: true, nome: true },
  })
  if (!novo) throw new ErroDeDominio("MOTORISTA_NAO_ENCONTRADO", "Motorista substituto não encontrado no cadastro.")
  // Mesmas regras de qualquer alocação: quem assume como principal precisa
  // poder viajar como principal (não enchedor, não em treinamento) e estar
  // autorizado pro produto da viagem.
  await garantirMotoristasValidos(filialId, {
    principalId: novo.id,
    produtoExigido: viagem.produto,
    atuais: { principalId: anteriorId, acompanhanteId: viagem.motoristaAcompanhanteId },
  })

  validarKmDoRegistro(dados.km, viagem.kmInicial, "Km da troca")
  validarHoraDoRegistro(dados.trocadoEm, viagem.horarioRealSaida, agora, "troca")
  // Segunda troca não volta no tempo nem no hodômetro (a linha do tempo e o
  // relatório ficariam incoerentes).
  const trocaAnterior = await prisma.trocaMotorista.findFirst({
    where: { viagemId },
    orderBy: { trocadoEm: "desc" },
    select: { km: true, trocadoEm: true },
  })
  if (trocaAnterior && dados.km < trocaAnterior.km) {
    throw new ErroDeDominio("KM_ANTES_TROCA_ANTERIOR", `O km da troca não pode ser menor que o da troca anterior (${trocaAnterior.km.toLocaleString("pt-BR")}).`)
  }
  if (trocaAnterior && dados.trocadoEm < trocaAnterior.trocadoEm) {
    throw new ErroDeDominio("HORA_ANTES_TROCA_ANTERIOR", "A hora da troca é antes da troca anterior — confira a data e a hora.")
  }
  const local = dados.local.trim().slice(0, TAMANHO_MAXIMO_LOCAL)
  const motivo = dados.motivo.trim().slice(0, TAMANHO_MAXIMO_MOTIVO_TROCA)
  if (!local) throw new ErroDeDominio("LOCAL_OBRIGATORIO", "Informe o local da troca.")
  if (!motivo) throw new ErroDeDominio("MOTIVO_OBRIGATORIO", "Informe o motivo da troca.")

  await prisma.$transaction(async (tx) => {
    // Só troca se ninguém mexeu na viagem no meio-tempo (outra troca, encerrou...).
    const { count } = await tx.viagem.updateMany({
      where: { id: viagemId, filialId, deletadoEm: null, motoristaId: anteriorId, status: { in: STATUS_EM_ANDAMENTO } },
      data: {
        motoristaId: novo.id,
        // O substituto era o acompanhante: agora é o principal, e o lugar de acompanhante fica vago.
        ...(viagem.motoristaAcompanhanteId === novo.id ? { motoristaAcompanhanteId: null } : {}),
      },
    })
    if (count === 0) throw new ErroDeDominio(CODIGO_VIAGEM_MUDOU, "A viagem foi alterada nesse meio-tempo. Atualize a tela e confira.")

    const troca = await tx.trocaMotorista.create({
      data: { viagemId, motoristaAnteriorId: anteriorId, motoristaNovoId: novo.id, km: dados.km, trocadoEm: dados.trocadoEm, local, motivo, usuarioId: ator.usuarioId },
    })
    const depois = await tx.viagem.findUniqueOrThrow({ where: { id: viagemId } })
    await registrarAuditoria(tx, { entidade: "Viagem", entidadeId: viagemId, acao: "ATUALIZACAO", antes: viagem, depois, ator, filialId })
    await registrarAuditoria(tx, { entidade: "TrocaMotorista", entidadeId: troca.id, acao: "CRIACAO", depois: troca, ator, filialId })

    // Mudou quem está na estrada: folga e avisos de descanso dos dois.
    await reconciliarFolgaMotoristasNoDiaAtual(tx, [anteriorId, novo.id], [{ inicioPrevisto: viagem.inicioPrevisto, fimPrevisto: viagem.fimPrevisto }])
    await recalcularAvisosInterjornada(tx, filialId, [anteriorId, novo.id])
  })

  return { motoristaNovo: novo.nome }
}

/** Trocas já feitas na viagem, da mais antiga pra mais nova (escopo pela filial). */
export async function buscarTrocasDaViagem(filialId: number, viagemId: number) {
  return prisma.trocaMotorista.findMany({
    where: { viagemId, viagem: { filialId } },
    orderBy: { trocadoEm: "asc" },
    select: {
      id: true,
      km: true,
      trocadoEm: true,
      local: true,
      motivo: true,
      motoristaAnterior: { select: { nome: true } },
      motoristaNovo: { select: { nome: true } },
    },
  })
}

/**
 * Motoristas que podem assumir a viagem: do cadastro da filial, que podem ser
 * principal e autorizados pro produto — a lista só mostra quem a troca aceita.
 */
export async function buscarSubstitutosPossiveis(filialId: number, excetoId: number | null, produto: TipoProduto | null) {
  const motoristas = await prisma.motorista.findMany({
    where: { filialId, deletadoEm: null, ...(excetoId ? { id: { not: excetoId } } : {}) },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, tipo: true, produtosAutorizados: true },
  })
  return motoristas
    .filter((m) => podeSerPrincipal(m.tipo) && (!produto || motoristaAutorizadoParaProduto(m.produtosAutorizados, produto)))
    .map(({ id, nome }) => ({ id, nome }))
}
