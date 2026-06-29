"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, type Path, type Resolver, type SubmitHandler } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Save, Trash2 } from "lucide-react"
import { editarMotorista } from "@/lib/actions/motoristas"
import type { EditarMotoristaInput } from "@/lib/types/types"
import { formatDateForDateInput, normalizeFormValue } from "@/lib/form-utils"
import { motoristaComIntegracoesSchema, type MotoristaComIntegracoesFormValues } from "@/lib/validation/motoristas"

type IntegracaoFormModel = {
  id: number
  cliente: string
  dataValidade: string | Date
  status: MotoristaComIntegracoesFormValues["integracao"][number]["status"]
}

type MotoristaComIntegracoes = {
  id: number
  nome: string
  seva: number
  diasTrabalhados: number
  turno: MotoristaComIntegracoesFormValues["turno"]
  integracao: IntegracaoFormModel[]
}

type FormEditarMotoristaProps = {
  motorista: MotoristaComIntegracoes
}

export default function FormEditarMotorista({ motorista }: FormEditarMotoristaProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<MotoristaComIntegracoesFormValues>({
    resolver: zodResolver(motoristaComIntegracoesSchema) as Resolver<MotoristaComIntegracoesFormValues>,
    defaultValues: {
      nome: motorista.nome,
      seva: motorista.seva,
      diasTrabalhados: motorista.diasTrabalhados,
      turno: motorista.turno,
      integracao: motorista.integracao.map((integracao) => ({
        id: integracao.id,
        cliente: integracao.cliente,
        dataValidade: formatDateForDateInput(integracao.dataValidade),
        status: integracao.status,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "integracao",
  })

  const onSubmit: SubmitHandler<MotoristaComIntegracoesFormValues> = async (dados) => {
    setErroGlobal("")

    const pacote: EditarMotoristaInput = {
      ...dados,
      integracao: dados.integracao.map((integracao) => ({
        id: integracao.id,
        cliente: integracao.cliente,
        dataValidade: new Date(integracao.dataValidade),
        status: integracao.status,
      })),
    }

    try {
      const resposta = await editarMotorista(motorista.id, pacote)

      if (resposta.sucesso) {
        router.push("/motorista")
        return
      }

      setErroGlobal(resposta.erro ?? "Erro interno ao salvar o motorista.")
    } catch (error) {
      if (error instanceof Error) {
        setErroGlobal(error.message)
        return
      }

      setErroGlobal("Falha de comunicação com o servidor.")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {erroGlobal && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-md font-medium">
            {erroGlobal}
          </div>
        )}

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Dados do Condutor</CardTitle>
            <CardDescription>Estes dados serão utilizados para as alocações de viagens.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João da Silva" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="seva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número SEVA</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 12345" {...field} value={normalizeFormValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="diasTrabalhados"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias Trabalhados</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 15" {...field} value={normalizeFormValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="turno"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Turno Operacional</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o turno" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MANHA">Manhã</SelectItem>
                      <SelectItem value="NOITE">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Integrações</CardTitle>
              <CardDescription>Gerencie as integrações vinculadas ao motorista.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  cliente: "",
                  dataValidade: "",
                  status: "PENDENTE",
                })
              }
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Nova Integração
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {fields.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma integração cadastrada para este motorista.</p>
            ) : (
              fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 border rounded-lg p-4 relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 text-red-500"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <FormField
                    control={form.control}
                    name={`integracao.${index}.cliente` as Path<MotoristaComIntegracoesFormValues>}
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel>Cliente</FormLabel>
                        <FormControl>
                          <Input {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`integracao.${index}.dataValidade` as Path<MotoristaComIntegracoesFormValues>}
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Validade</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`integracao.${index}.status` as Path<MotoristaComIntegracoesFormValues>}
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={typeof field.value === "string" ? field.value : ""}
                          onValueChange={(value) => field.onChange(value as "ATIVO" | "INATIVO" | "PENDENTE")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ATIVO">Ativo</SelectItem>
                            <SelectItem value="INATIVO">Inativo</SelectItem>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-40 shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            {form.formState.isSubmitting ? "A guardar..." : "Atualizar"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
