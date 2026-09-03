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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save } from "lucide-react"
import { normalizeFormValue } from "@/lib/form-utils"
import { clienteSchema, type ClienteFormValues } from "@/lib/validation/clientes"
import type { RespostaAcao } from "@/lib/types/types"

type ClienteFormProps = {
  defaultValues: ClienteFormValues
  onSubmit: (dados: ClienteFormValues) => Promise<RespostaAcao>
  submitLabel: string
  submittingLabel: string
}

export default function ClienteForm({ defaultValues, onSubmit, submitLabel, submittingLabel }: ClienteFormProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema) as Resolver<ClienteFormValues>,
    defaultValues,
  })

  const handleSubmit: SubmitHandler<ClienteFormValues> = async (dados) => {
    setErroGlobal("")

    try {
      const resposta = await onSubmit(dados)

      if (resposta.sucesso) {
        router.push("/clientes")
        return
      }

      setErroGlobal(resposta.erro ?? "Erro interno ao salvar o cliente.")
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
            <CardTitle className="text-lg">Cliente</CardTitle>
            <CardDescription>
              O nome cadastrado aqui aparece pra escolher nas entregas da viagem e nas integrações do motorista.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do cliente</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: WEG" {...field} value={normalizeFormValue(field.value)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="numeroSap" render={({ field }) => (
              <FormItem>
                <FormLabel>SAP Code</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 4521087" {...field} value={normalizeFormValue(field.value)} />
                </FormControl>
                <FormDescription>
                  Mesmo SAP Code preenchido nas entregas da viagem — é ele, não o nome, que valida as integrações do motorista.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="exigeIntegracao" render={({ field }) => (
              <FormItem>
                <FormLabel>Exige integração do motorista</FormLabel>
                <Select value={field.value ? "true" : "false"} onValueChange={(value) => field.onChange(value === "true")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="false">Não</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Se marcado, toda viagem com uma entrega cujo SAP Code bata com o cadastrado acima exige que o motorista tenha uma integração ativa e válida com esse cliente.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-40 shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            {form.formState.isSubmitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
