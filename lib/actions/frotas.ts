'use server'
import { revalidatePath } from "next/cache";
import { type RespostaAcao } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { requireSessionComFilial } from "@/lib/auth-guard";
import { frotaSchema, type FrotaFormValues } from "@/lib/validation/frotas";
import {
  criarFrotaService,
  editarFrotaService,
  deletarFrotaService,
} from "@/lib/services/frota.service";

export async function criarFrota(dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    const { filialId } = await requireSessionComFilial();

    const validacao = frotaSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await criarFrotaService(filialId, validacao.data);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar conjunto.") };
  }
}

export async function editarFrota(id: number, dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    const { filialId } = await requireSessionComFilial();

    const validacao = frotaSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await editarFrotaService(filialId, id, validacao.data);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar conjunto.") };
  }
}

export async function deletarFrota(id: number): Promise<RespostaAcao> {
  try {
    const { filialId } = await requireSessionComFilial(["ADMIN"]);
    await deletarFrotaService(filialId, id);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar conjunto.") };
  }
}
