import { prisma } from "@/lib/prisma"
import { ErroDeDominio, ViagemNaoEncontradaError } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import { recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/minhas-viagens.service"
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

const KM_MAXIMO_POR_VIAGEM = 10_000
const FOLGA_FUTURO_MS = 5 * 60 * 1000

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

  if (!Number.isInteger(dados.km) || dados.km < 0 || dados.km > 9_999_999) {
    throw new ErroDeDominio("KM_INVALIDO", "Km da troca: informe o número do hodômetro.")
  }
  if (viagem.kmInicial !== null && (dados.km < viagem.kmInicial || dados.km - viagem.kmInicial > KM_MAXIMO_POR_VIAGEM)) {
    throw new ErroDeDominio("KM_TROCA_FORA", `O km da troca precisa estar entre o km inicial (${viagem.kmInicial}) e ${viagem.kmInicial + KM_MAXIMO_POR_VIAGEM}.`)
  }
  if (Number.isNaN(dados.trocadoEm.getTime()) || dados.trocadoEm.getTime() > agora.getTime() + FOLGA_FUTURO_MS) {
    throw new ErroDeDominio("TROCA_FUTURO", "A hora da troca está no futuro — confira a data e a hora.")
  }
  if (viagem.horarioRealSaida && dados.trocadoEm.getTime() < Math.floor(viagem.horarioRealSaida.getTime() / 60_000) * 60_000) {
    throw new ErroDeDominio("TROCA_ANTES_SAIDA", "A hora da troca é antes da saída da viagem — confira a data e a hora.")
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
    if (count === 0) throw new ErroDeDominio("VIAGEM_MUDOU", "A viagem foi alterada nesse meio-tempo. Atualize a tela e confira.")

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

/** Trocas já feitas na viagem, da mais antiga pra mais nova. */
export async function buscarTrocasDaViagem(viagemId: number) {
  return prisma.trocaMotorista.findMany({
    where: { viagemId },
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

/** Motoristas que podem assumir (cadastro da filial), pra lista da troca. */
export async function buscarSubstitutosPossiveis(filialId: number, excetoId: number | null) {
  return prisma.motorista.findMany({
    where: { filialId, deletadoEm: null, ...(excetoId ? { id: { not: excetoId } } : {}) },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  })
}
