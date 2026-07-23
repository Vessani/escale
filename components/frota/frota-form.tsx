"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Save } from "lucide-react"
import { normalizeFormValue } from "@/lib/form-utils"
import { frotaSchema, type FrotaFormValues } from "@/lib/validation/frotas"
import type { RespostaAcao } from "@/lib/types/types"

type FrotaFormProps = {
  defaultValues: FrotaFormValues
  onSubmit: (dados: FrotaFormValues) => Promise<RespostaAcao>
  submitLabel: string
  submittingLabel: string
}

export default function FrotaForm({ defaultValues, onSubmit, submitLabel, submittingLabel }: FrotaFormProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<FrotaFormValues>({
    resolver: zodResolver(frotaSchema) as Resolver<FrotaFormValues>,
    defaultValues,
  })

  const handleSubmit: SubmitHandler<FrotaFormValues> = async (dados) => {
    setErroGlobal("")

    try {
      const resposta = await onSubmit(dados)

      if (resposta.sucesso) {
        router.push("/frotas")
        return
      }

      setErroGlobal(resposta.erro ?? "Erro interno ao salvar o conjunto.")
    } catch {
      setErroGlobal("Falha de comunicação com o servidor.")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {erroGlobal && <Alert variant="error" className="font-medium">{erroGlobal}</Alert>}

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Conjunto</CardTitle>
            <CardDescription>
              Frota cavalo e carreta — pra veículo truck (sem reboque separado), use o mesmo número nos dois campos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="cavalo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Cavalo)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 2024" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="carreta" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Carreta)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 274" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="disponivelEm" render={({ field }) => (
              <FormItem>
                <FormLabel>Disponível a partir de</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                </FormControl>
                <FormDescription>Deixe em branco se já está disponível agora.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-40 shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            {form.formState.isSubmitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
