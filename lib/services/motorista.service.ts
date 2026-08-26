import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types";
import { dataParaColunaDate, inicioDoDia } from "@/lib/utils/date-format";
import { registrarAuditoria, type Ator } from "./auditoria.service";

export async function criarMotoristaService(filialId: number, dados: NovoMotoristaInput, ator: Ator | null) {
  const hoje = inicioDoDia(new Date());

  return await prisma.$transaction(async (tx) => {
    const motoristaCriado = await tx.motorista.create({
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        seva: dados.seva,
        diasTrabalhados: dados.diasTrabalhados,
        turno: dados.turno,
        liberado: dados.liberado,
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
    });

    // Âncora inicial do histórico de jornada
    await registrarJornadaNoDia(tx, motoristaCriado.id, hoje, dados.diasTrabalhados);

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: motoristaCriado.id,
      acao: "CRIACAO",
      depois: motoristaCriado,
      ator,
      filialId,
    });

    return motoristaCriado;
  });
}

export async function editarMotoristaService(filialId: number, idMotorista: number, dados: EditarMotoristaInput, ator: Ator | null) {
  const integracaoExistentes = dados.integracao.filter(i => i.id);
  const integracaoNovas = dados.integracao.filter(i => !i.id);
  const manterIntegracao = integracaoExistentes.map(i => i.id as number);

  const motoristaAntes = await prisma.motorista.findUniqueOrThrow({ where: { id: idMotorista, filialId } });

  return await prisma.$transaction(async (tx) => {
    const motoristaAtualizado = await tx.motorista.update({
      where: { id: idMotorista, filialId },
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        seva: dados.seva,
        diasTrabalhados: dados.diasTrabalhados,
        turno: dados.turno,
        liberado: dados.liberado,
        produtosAutorizados: dados.produtosAutorizados,
        integracao: {
          deleteMany: {
            id: { notIn: manterIntegracao }
          },
          update: integracaoExistentes.map((integracao) => ({
            where: { id: integracao.id },
            data: {
              dataValidade: new Date(integracao.dataValidade),
              cliente: integracao.cliente,
              status: integracao.status,
            }
          })),
          create: integracaoNovas.map((integracao) => ({
            dataValidade: new Date(integracao.dataValidade),
            cliente: integracao.cliente,
            status: integracao.status,
          }))
        }
      }
    });

    // O campo "Dias Trabalhados" no formulário representa a jornada de hoje —
    // mantém isso registrado no histórico também. Inline (não
    // registrarJornadaNoDiaService, que abriria uma segunda transação) pra
    // ficar atômico com o update acima.
    await registrarJornadaNoDia(tx, idMotorista, inicioDoDia(new Date()), dados.diasTrabalhados);

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: idMotorista,
      acao: "ATUALIZACAO",
      antes: motoristaAntes,
      depois: motoristaAtualizado,
      ator,
      filialId,
    });

    return motoristaAtualizado;
  });
}

export async function deletarMotoristaService(filialId: number, id: number, ator: Ator | null) {
  const motoristaAntes = await prisma.motorista.findUniqueOrThrow({ where: { id, filialId } });

  return await prisma.$transaction(async (tx) => {
    const motoristaDeletado = await tx.motorista.update({
      where: { id: id, filialId },
      data: {
        deletadoEm: new Date(),
      }
    });

    await registrarAuditoria(tx, {
      entidade: "Motorista",
      entidadeId: id,
      acao: "EXCLUSAO",
      antes: motoristaAntes,
      depois: motoristaDeletado,
      ator,
      filialId,
    });

    return motoristaDeletado;
  });
}

/**
 * Registra o código de jornada de um motorista num dia específico (histórico
 * usado pelo calendário — ver `jornada.service.ts#projetarCodigoNoDia`).
 * Só atualiza o cache `Motorista.diasTrabalhados` quando o dia registrado é
 * hoje; editar um dia passado ou futuro nunca afeta o que "hoje" mostra.
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
  horas?: { inicioJornada: Date; fimJornada: Date },
) {
  const diaRegistro = inicioDoDia(data);
  const hoje = inicioDoDia(new Date());
  const ehHoje = diaRegistro.getTime() === hoje.getTime();

  const dataColuna = dataParaColunaDate(diaRegistro);

  const registro = await tx.registroJornada.upsert({
    where: { motoristaId_data: { motoristaId: idMotorista, data: dataColuna } },
    create: {
      motoristaId: idMotorista,
      data: dataColuna,
      codigo,
      inicioJornada: horas?.inicioJornada ?? null,
      fimJornada: horas?.fimJornada ?? null,
    },
    update: {
      codigo,
      ...(horas ? { inicioJornada: horas.inicioJornada, fimJornada: horas.fimJornada } : {}),
    },
  });

  if (ehHoje) {
    await tx.motorista.update({
      where: { id: idMotorista },
      data: { diasTrabalhados: codigo },
    });
  }

  return registro;
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
    const registro = await registrarJornadaNoDia(tx, idMotorista, data, codigo)

    await registrarAuditoria(tx, {
      entidade: "RegistroJornada",
      entidadeId: registro.id,
      acao: "ATUALIZACAO",
      depois: registro,
      ator,
      filialId,
    });

    return registro
  });
}

/**
 * Fim da última jornada real (com horário importado) estritamente anterior
 * ao início da viagem sendo avaliada — versão que consulta direto o banco por
 * um único motorista/viagem, usada onde só se tem o id do motorista (sem o
 * objeto completo, com o histórico já carregado — nesse caso, prefira
 * `encontrarFimJornadaAnterior` em jornada.service.ts, sem I/O extra). Ver o
 * comentário lá pra explicação completa do porquê isso substitui
 * `Motorista.jornadaRelatorioFim` como referência de interjornada.
 */
export async function buscarFimJornadaAnterior(filialId: number, motoristaId: number, inicioViagem: Date): Promise<Date | null> {
  const registro = await prisma.registroJornada.findFirst({
    where: {
      motoristaId,
      motorista: { filialId },
      fimJornada: { not: null, lt: inicioViagem },
    },
    orderBy: { fimJornada: "desc" },
    select: { fimJornada: true },
  })

  return registro?.fimJornada ?? null
}
