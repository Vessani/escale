'use server'
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { usuarioSchema, trocarSenhaSchema, type UsuarioFormValues, type TrocarSenhaFormValues } from "@/lib/validation/usuarios";
import type { RespostaAcao } from "@/lib/types/types";
import { atorDaSessao } from "@/lib/services/auditoria.service";
import { alterarUsuarioAtivoService, criarUsuarioService, trocarSenhaPropriaService } from "@/lib/services/usuario.service";
import { z } from "@/lib/validation/zod";

export async function criarUsuario(dados: UsuarioFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["SUPERADMIN"]);
    await criarUsuarioService(usuarioSchema.parse(dados), atorDaSessao(session));
    revalidatePath("/admin/usuarios");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar usuário.") };
  }
}

/** Ativa/desativa um usuário (ver alterarUsuarioAtivoService). */
export async function alterarUsuarioAtivo(usuarioId: string, ativo: boolean): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["SUPERADMIN"]);
    await alterarUsuarioAtivoService(z.string().min(1).max(40).parse(usuarioId), z.boolean().parse(ativo), atorDaSessao(session));
    revalidatePath("/admin/usuarios");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao alterar o usuário.") };
  }
}

/** Troca de senha self-service — qualquer papel autenticado troca a própria senha, mediante confirmação da atual. */
export async function trocarSenhaPropria(dados: TrocarSenhaFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession();
    await trocarSenhaPropriaService(atorDaSessao(session), session.user.filialId ?? null, trocarSenhaSchema.parse(dados));
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao trocar a senha.") };
  }
}
