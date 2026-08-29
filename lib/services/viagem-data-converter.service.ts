/**
 * Converter centralizado para dados de viagem
 * Responsabilidade única: converter strings para Date objects para o Prisma
 * 
 * SOLID Principles:
 * - Single Responsibility: Apenas converte tipos
 * - Open/Closed: Fácil estender para novos tipos
 * - DRY: Uma única fonte de verdade para conversão
 */

import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { calcularDiasEntre, converterEntradaDeDataHora } from "@/lib/utils/date-format";
import { DataInvalidaError } from "@/lib/errors";

/**
 * Converte strings de data (datetime-local) para Date objects, interpretando
 * o horário como Brasília em vez do fuso do processo que executa o código
 * (ver converterEntradaDeDataHora) — esperado: formato YYYY-MM-DDTHH:MM como
 * vem do input datetime-local, ou uma string já com timezone/Date.
 *
 * mensagemSegura fica genérica ("Data inválida.") de propósito — o valor cru
 * recebido nunca vai pro usuário, só pro log, pra não vazar dado de entrada
 * bruto numa mensagem de erro.
 */
function converterDataParaDate(data: string | Date): Date {
  if (!data) {
    console.error("[viagem-data-converter] Data inválida: valor vazio");
    throw new DataInvalidaError();
  }

  const date = converterEntradaDeDataHora(data);
  if (isNaN(date.getTime())) {
    console.error(`[viagem-data-converter] Data inválida: ${data}`);
    throw new DataInvalidaError();
  }
  return date;
}

/**
 * Converte NovaViagemInput: strings → Dates para Prisma
 */
export function converterNovaViagemParaBD(
  dados: NovaViagemInput
): NovaViagemInput {
  const inicioPrevisto = converterDataParaDate(dados.inicioPrevisto);
  const fimPrevisto = converterDataParaDate(dados.fimPrevisto);

  return {
    ...dados,
    inicioPrevisto,
    fimPrevisto,
    // Fonte de verdade é o intervalo de datas, não o número enviado pelo
    // formulário — evita desincronia entre "duração" e o intervalo real.
    diasViagem: calcularDiasEntre(inicioPrevisto, fimPrevisto),
    entregas: dados.entregas.map(entrega => ({
      ...entrega,
      dataEntrega: converterDataParaDate(entrega.dataEntrega),
    })),
  };
}

/**
 * Converte EditarViagemInput: strings → Dates para Prisma
 */
export function converterEditarViagemParaBD(
  dados: EditarViagemInput
): EditarViagemInput {
  const inicioPrevisto = converterDataParaDate(dados.inicioPrevisto);
  const fimPrevisto = converterDataParaDate(dados.fimPrevisto);

  return {
    ...dados,
    inicioPrevisto,
    fimPrevisto,
    diasViagem: calcularDiasEntre(inicioPrevisto, fimPrevisto),
    entregas: dados.entregas.map(entrega => ({
      ...entrega,
      dataEntrega: converterDataParaDate(entrega.dataEntrega),
    })),
  };
}
