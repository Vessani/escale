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

/**
 * Converte strings de data (datetime-local) para Date objects
 * Esperado: formato YYYY-MM-DDTHH:MM como vem do input datetime-local
 */
function converterDataParaDate(data: string | Date): Date {
  if (data instanceof Date) return data;
  if (!data) throw new Error("Data inválida: valor vazio");
  
  const date = new Date(data);
  if (isNaN(date.getTime())) {
    throw new Error(`Data inválida: ${data}`);
  }
  return date;
}

/**
 * Converte NovaViagemInput: strings → Dates para Prisma
 */
export function converterNovaViagemParaBD(
  dados: NovaViagemInput
): NovaViagemInput {
  return {
    ...dados,
    inicioPrevisto: converterDataParaDate(dados.inicioPrevisto),
    fimPrevisto: converterDataParaDate(dados.fimPrevisto),
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
  return {
    ...dados,
    inicioPrevisto: converterDataParaDate(dados.inicioPrevisto),
    fimPrevisto: converterDataParaDate(dados.fimPrevisto),
    entregas: dados.entregas.map(entrega => ({
      ...entrega,
      dataEntrega: converterDataParaDate(entrega.dataEntrega),
    })),
  };
}
