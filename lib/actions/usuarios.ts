'use server'
import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { usuarioSchema, type UsuarioFormValues } from "@/lib/validation/usuarios";
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
