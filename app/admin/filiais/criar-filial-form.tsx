"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { PlusCircle } from "lucide-react"
import { criarFilial } from "@/lib/actions/filiais"
import { filialSchema, type FilialFormValues } from "@/lib/validation/filiais"

export default function CriarFilialForm() {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  const form = useForm<FilialFormValues>({
    resolver: zodResolver(filialSchema),
    defaultValues: { nome: "" },
  })

  const handleSubmit: SubmitHandler<FilialFormValues> = async (dados) => {
    setErro(null)
    const resposta = await criarFilial(dados)

    if (!resposta.sucesso) {
      setErro(resposta.erro ?? "Não foi possível criar a filial.")
      return
    }

    form.reset({ nome: "" })
    router.refresh()
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">Nova filial</CardTitle>
        <CardDescription>Cria uma filial isolada — motoristas, viagens e frotas dela não ficam visíveis pras outras.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Nome da filial</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Filial Joinville" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <PlusCircle className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting ? "Criando..." : "Criar filial"}
              </Button>
            </div>
            {erro && <Alert variant="error">{erro}</Alert>}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
