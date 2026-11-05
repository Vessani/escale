import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types"
import { ErroDeDominio } from "@/lib/errors"
import { filtroAtividadeNoDia } from "@/lib/queries/motoristas"
import { dataParaColunaDate, inicioDoDia } from "@/lib/utils/date-format"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import { CODIGO_FOLGA } from "./codigo-jornada"
import { prepararJornadaDoMotorista, situacaoDoDia } from "./jornada.service"

/** Escalado não folga no dia: quem escala precisa tirar da viagem primeiro. */
async function garantirQuePodeFolgar(tx: Prisma.TransactionClient, idMotorista: number, dia: Date) {
  const viagensNoDia = await tx.viagem.count({
    where: { AND: [filtroAtividadeNoDia(dia), { OR: [{ motoristaId: idMotorista }, { motoristaAcompanhanteId: idMotorista }] }] },
  })
  if (viagensNoDia > 0) {
    throw new ErroDeDominio(
      "FOLGA_COM_VIAGEM",
      "Motorista escalado nesse dia não pode ficar de folga. Marque Interno ou tire ele da viagem.",
    )
  }
}

export async function criarMotoristaService(filialId: number, dados: NovoMotoristaInput, ator: Ator | null) {
  const hoje = inicioDoDia(new Date())

  return await prisma.$transaction(async (tx) => {
    const motoristaCriado = await tx.motorista.create({
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        seva: dados.seva,
        turno: dados.turno,
        tipo: dados.tipo,
        produtosAutorizados: dados.produtosAutorizados,
        filialId,
        integracao: {
          create: dados.integracao.map((integ) => ({
            dataValidade: new Date(integ.dataValidade),
            cliente: integ.cliente,
            status: integ.status,
          })),
        },
      },
      include: {
        integracao: true,
      },
    })

    // Âncora inicial do histórico de jornada
    await registrarJornadaNoDia(tx, motoristaCriado.id, hoje, dados.codigoHoje)

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: motoristaCriado.id,
      acao: "CRIACAO",
      depois: motoristaCriado,
      ator,
      filialId,
    })

    return motoristaCriado
  })
}

export async function editarMotoristaService(filialId: number, idMotorista: number, dados: EditarMotoristaInput, ator: Ator | null) {
  const integracaoExistentes = dados.integracao.filter((i) => i.id)
  const integracaoNovas = dados.integracao.filter((i) => !i.id)
  const manterIntegracao = integracaoExistentes.map((i) => i.id as number)

  const motoristaAntes = await prisma.motorista.findUniqueOrThrow({ where: { id: idMotorista, filialId } })
  const { registrosJornada, filial } = await prisma.motorista.findUniqueOrThrow({
    where: { id: idMotorista, filialId },
    select: {
      registrosJornada: { select: { data: true, codigo: true, fimJornada: true } },
      filial: { select: { relatorioJornadaAte: true } },
    },
  })
  const hoje = inicioDoDia(new Date())
  const jornada = prepararJornadaDoMotorista({ registrosJornada, filial })
  const codigoMudou = dados.codigoHoje !== situacaoDoDia(jornada, hoje, hoje).codigo

  return await prisma.$transaction(async (tx) => {
    if (codigoMudou && dados.codigoHoje === CODIGO_FOLGA) await garantirQuePodeFolgar(tx, idMotorista, hoje)

    const motoristaAtualizado = await tx.motorista.update({
      where: { id: idMotorista, filialId },
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        seva: dados.seva,
        turno: dados.turno,
        tipo: dados.tipo,
        produtosAutorizados: dados.produtosAutorizados,
        integracao: {
          deleteMany: {
            id: { notIn: manterIntegracao },
          },
          update: integracaoExistentes.map((integracao) => ({
            where: { id: integracao.id },
            data: {
              dataValidade: new Date(integracao.dataValidade),
              cliente: integracao.cliente,
              status: integracao.status,
            },
          })),
          create: integracaoNovas.map((integracao) => ({
            dataValidade: new Date(integracao.dataValidade),
            cliente: integracao.cliente,
            status: integracao.status,
          })),
        },
      },
    })

    // O campo de jornada no formulário representa a jornada de hoje.
    // Só grava se alguém mudou: salvar o nome não pode transformar a projeção
    // de hoje num registro, que vira âncora dos dias seguintes. Inline (não
    // registrarJornadaNoDiaService, que abriria uma segunda transação) pra
    // ficar atômico com o update acima.
    if (codigoMudou) await registrarJornadaNoDia(tx, idMotorista, hoje, dados.codigoHoje)

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: idMotorista,
      acao: "ATUALIZACAO",
      antes: motoristaAntes,
      depois: motoristaAtualizado,
      ator,
      filialId,
    })

    return motoristaAtualizado
  })
}

export async function deletarMotoristaService(filialId: number, id: number, ator: Ator | null) {
  const motoristaAntes = await prisma.motorista.findUniqueOrThrow({ where: { id, filialId } })

  return await prisma.$transaction(async (tx) => {
    const motoristaDeletado = await tx.motorista.update({
      where: { id: id, filialId },
      data: {
        deletadoEm: new Date(),
      },
    })

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: id,
      acao: "EXCLUSAO",
      antes: motoristaAntes,
      depois: motoristaDeletado,
      ator,
      filialId,
    })

    return motoristaDeletado
  })
}

/**
 * Registra o código de jornada de um motorista num dia específico (histórico
 * usado pelo calendário — ver `jornada.service.ts#situacaoDoDia`).
 *
 * `horas` (opcional) grava o horário real de início/fim daquele dia — só o
 * import do Relatório de Jornada tem esse dado (ver jornada-relatorio.service.ts).
 * Omitido, nunca apaga um horário já gravado num `update` (edição manual do
 * calendário, criação de motorista e reconciliação de folga não têm horário
 * real, então não devem sobrescrever um que já exista).
 *
 * Recebe a transação (`tx`) de fora para poder ser chamada tanto isoladamente
 * quanto dentro de uma transação maior já aberta (ex: reconciliação de folga).
 */
export async function registrarJornadaNoDia(
  tx: Prisma.TransactionClient,
  idMotorista: number,
  data: Date,
  codigo: number,
  horas?: { inicioJornada: Date; fimJornada: Date; diasSemFolga?: number },
) {
  const diaRegistro = inicioDoDia(data)

  const dataColuna = dataParaColunaDate(diaRegistro)

  return await tx.registroJornada.upsert({
    where: { motoristaId_data: { motoristaId: idMotorista, data: dataColuna } },
    create: {
      motoristaId: idMotorista,
      data: dataColuna,
      codigo,
      inicioJornada: horas?.inicioJornada ?? null,
      fimJornada: horas?.fimJornada ?? null,
      diasSemFolga: horas?.diasSemFolga ?? null,
    },
    update: {
      codigo,
      ...(horas ? { inicioJornada: horas.inicioJornada, fimJornada: horas.fimJornada, diasSemFolga: horas.diasSemFolga ?? null } : {}),
    },
  })
}

/**
 * Ponto de entrada usado pela action de calendário (edição direta de um dia
 * específico) — diferente de registrarJornadaNoDia (chamada interna, já
 * confia no id porque veio de uma operação já escopada por filial), aqui o
 * id do motorista vem direto do cliente, então confirma antes que ele
 * pertence à filial de quem está editando.
 */
export async function registrarJornadaNoDiaService(filialId: number, idMotorista: number, data: Date, codigo: number, ator: Ator | null) {
  return await prisma.$transaction(async (tx) => {
    await tx.motorista.findUniqueOrThrow({ where: { id: idMotorista, filialId }, select: { id: true } })
    if (codigo === CODIGO_FOLGA) await garantirQuePodeFolgar(tx, idMotorista, data)
    const registro = await registrarJornadaNoDia(tx, idMotorista, data, codigo)

    await registrarAuditoria(tx, {
      entidade: "RegistroJornada",
      entidadeId: registro.id,
      acao: "ATUALIZACAO",
      depois: registro,
      ator,
      filialId,
    })

    return registro
  })
}
