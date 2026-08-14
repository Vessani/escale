'use server'
import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { usuarioSchema, trocarSenhaSchema, type UsuarioFormValues, type TrocarSenhaFormValues } from "@/lib/validation/usuarios";
import type { RespostaAcao } from "@/lib/types/types";

const CUSTO_HASH_SENHA = 10

export async function criarUsuario(dados: UsuarioFormValues): Promise<RespostaAcao> {
  try {
    await requireSession(["SUPERADMIN"]);

    const validacao = usuarioSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const senhaHash = await bcrypt.hash(validacao.data.senha, CUSTO_HASH_SENHA);

    await prisma.usuario.create({
      data: {
        nome: validacao.data.nome,
        email: validacao.data.email,
        senha: senhaHash,
        role: validacao.data.role,
        filialId: validacao.data.role === "SUPERADMIN" ? null : validacao.data.filialId,
      },
    });

    revalidatePath("/admin/usuarios");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar usuário.") };
  }
}

/** Troca de senha self-service — qualquer papel autenticado troca a própria senha, mediante confirmação da atual. */
export async function trocarSenhaPropria(dados: TrocarSenhaFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession();

    const validacao = trocarSenhaSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id } });
    if (!usuario?.senha) {
      return { sucesso: false, erro: "Usuário inválido." };
    }

    const senhaAtualConfere = await bcrypt.compare(validacao.data.senhaAtual, usuario.senha);
    if (!senhaAtualConfere) {
      return { sucesso: false, erro: "Senha atual incorreta." };
    }

    const senhaHash = await bcrypt.hash(validacao.data.novaSenha, CUSTO_HASH_SENHA);
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { senha: senhaHash },
    });

    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao trocar a senha.") };
  }
}
