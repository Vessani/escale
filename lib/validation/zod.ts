import * as z from "zod"

/**
 * Zod com as mensagens padrão em português — todos os schemas de
 * lib/validation importam `z` daqui, nunca direto de "zod". Sem isso, campo
 * sem mensagem customizada (ex: z.enum do produto vazio) aparecia pro
 * usuário como "Invalid option: expected one of ...".
 *
 * z.config é global no processo, mas só roda quando este módulo é
 * importado — por isso o re-export: quem usa `z` daqui garante que a
 * configuração já foi aplicada, tanto no navegador quanto no servidor.
 */
z.config(z.locales.pt())

export { z }
