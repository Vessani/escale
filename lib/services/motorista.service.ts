import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types";
import { dataParaColunaDate, inicioDoDia } from "@/lib/utils/date-format";

export async function criarMotoristaService(filialId: number, dados: NovoMotoristaInput) {
  const hoje = inicioDoDia(new Date());

  return await prisma.$transaction(async (tx) => {
    const motoristaCriado = await tx.motorista.create({
      data: {
        nome: dados.nome,
        seva: dados.seva,
        diasTrabalhados: dados.diasTrabalhados,
        turno: dados.turno,
        liberado: dados.liberado,
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

    return motoristaCriado;
  });
}

export async function editarMotoristaService(filialId: number, idMotorista: number, dados: EditarMotoristaInput) {
  const integracaoExistentes = dados.integracao.filter(i => i.id);
  const integracaoNovas = dados.integracao.filter(i => !i.id);
  const manterIntegracao = integracaoExistentes.map(i => i.id as number);

  const motoristaAtualizado = await prisma.motorista.update({
    where: { id: idMotorista, filialId },
    data: {
      nome: dados.nome,
      seva: dados.seva,
      diasTrabalhados: dados.diasTrabalhados,
      turno: dados.turno,
      liberado: dados.liberado,
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
  // mantém isso registrado no histórico também (ver registrarJornadaNoDiaService).
  await registrarJornadaNoDiaService(filialId, idMotorista, inicioDoDia(new Date()), dados.diasTrabalhados);

  return motoristaAtualizado;
}

export async function deletarMotoristaService(filialId: number, id: number) {
  return await prisma.motorista.update({
    where: { id: id, filialId },
    data: {
      deletadoEm: new Date(),
    }
  });
}

/**
 * Registra o código de jornada de um motorista num dia específico (histórico
 * usado pelo calendário — ver `jornada.service.ts#projetarCodigoNoDia`).
 * Só atualiza o cache `Motorista.diasTrabalhados` quando o dia registrado é
 * hoje; editar um dia passado ou futuro nunca afeta o que "hoje" mostra.
 *
 * Recebe a transação (`tx`) de fora para poder ser chamada tanto isoladamente
 * quanto dentro de uma transação maior já aberta (ex: reconciliação de folga).
 */
export async function registrarJornadaNoDia(
  tx: Prisma.TransactionClient,
  idMotorista: number,
  data: Date,
  codigo: number,
) {
  const diaRegistro = inicioDoDia(data);
  const hoje = inicioDoDia(new Date());
  const ehHoje = diaRegistro.getTime() === hoje.getTime();

  const dataColuna = dataParaColunaDate(diaRegistro);

  const registro = await tx.registroJornada.upsert({
    where: { motoristaId_data: { motoristaId: idMotorista, data: dataColuna } },
    create: { motoristaId: idMotorista, data: dataColuna, codigo },
    update: { codigo },
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
export async function registrarJornadaNoDiaService(filialId: number, idMotorista: number, data: Date, codigo: number) {
  return await prisma.$transaction(async (tx) => {
    await tx.motorista.findUniqueOrThrow({ where: { id: idMotorista, filialId }, select: { id: true } })
    return registrarJornadaNoDia(tx, idMotorista, data, codigo)
  });
}
