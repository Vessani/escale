"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form"
import { Dialog } from "radix-ui"
import { KeyRound } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { trocarSenhaPropria } from "@/lib/actions/usuarios"
import { trocarSenhaSchema, type TrocarSenhaFormValues } from "@/lib/validation/usuarios"

const valoresPadrao: TrocarSenhaFormValues = { senhaAtual: "", novaSenha: "", confirmarSenha: "" }

export default function TrocarSenhaDialog({ colapsado = false }: { colapsado?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const form = useForm<TrocarSenhaFormValues>({
    resolver: zodResolver(trocarSenhaSchema) as Resolver<TrocarSenhaFormValues>,
    defaultValues: valoresPadrao,
  })

  const fechar = (aberto: boolean) => {
    setAberto(aberto)
    if (!aberto) {
      form.reset(valoresPadrao)
      setSucesso(false)
    }
  }

  const onSubmit: SubmitHandler<TrocarSenhaFormValues> = async (dados) => {
    const resposta = await trocarSenhaPropria(dados)

    if (!resposta.sucesso) {
      form.setError("root", { message: resposta.erro ?? "Não foi possível trocar a senha." })
      return
    }

    form.clearErrors("root")
    setSucesso(true)
    form.reset(valoresPadrao)
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={fechar}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          title={colapsado ? "Trocar senha" : undefined}
          className="mt-2 w-full flex items-center justify-center px-3 py-2 text-sm text-slate-300 bg-slate-800/60 hover:bg-slate-800 rounded-md transition-colors"
        >
          <KeyRound aria-hidden="true" className={`w-4 h-4 ${colapsado ? "" : "mr-2"}`} />
          <span className={colapsado ? "sr-only" : ""}>Trocar senha</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-slate-900">Trocar senha</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-600">
            Informe a senha atual e a nova senha.
          </Dialog.Description>

          {sucesso ? (
            <>
              <Alert variant="success" className="mt-4">Senha atualizada com sucesso.</Alert>
              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={() => fechar(false)}>Fechar</Button>
              </div>
            </>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-3">
                <FormField control={form.control} name="senhaAtual" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha atual</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="novaSenha" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="confirmarSenha" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {form.formState.errors.root && (
                  <Alert variant="error">{form.formState.errors.root.message}</Alert>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => fechar(false)} disabled={form.formState.isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Salvando..." : "Trocar senha"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
