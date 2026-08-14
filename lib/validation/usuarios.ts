import * as z from "zod"

const roleSchema = z.enum(["SUPERADMIN", "ADMIN", "DESPACHANTE"])

/** filialId é obrigatório pra todo papel, exceto SUPERADMIN — ver comentário em prisma/schema.prisma (model Usuario). */
export const usuarioSchema = z
  .object({
    nome: z.string().min(2, "Nome obrigatório").max(100, "Máximo de 100 caracteres"),
    email: z.string().min(1, "E-mail obrigatório").email("E-mail inválido"),
    senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    role: roleSchema,
    filialId: z.number().nullable(),
  })
  .refine((dados) => dados.role === "SUPERADMIN" || dados.filialId !== null, {
    message: "Selecione uma filial.",
    path: ["filialId"],
  })

export type UsuarioFormValues = z.infer<typeof usuarioSchema>

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual"),
    novaSenha: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((dados) => dados.novaSenha === dados.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  })

export type TrocarSenhaFormValues = z.infer<typeof trocarSenhaSchema>
