"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, type Path, type Resolver, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, PlusCircle, Trash2 } from "lucide-react"
import { normalizeFormValue } from "@/lib/form-utils"
import { motoristaComIntegracoesSchema, type MotoristaComIntegracoesFormValues } from "@/lib/validation/motoristas"
import type { RespostaAcao } from "@/lib/types/types"
import { formatarCpf, somenteDigitosCpf } from "@/lib/utils/cpf"
import { PRODUTO_OPCOES } from "@/lib/services/produto.service"

type MotoristaFormProps = {
  defaultValues: MotoristaComIntegracoesFormValues
  onSubmit: (dados: MotoristaComIntegracoesFormValues) => Promise<RespostaAcao>
  submitLabel: string
  submittingLabel: string
  /** Cadastro de clientes (ver app/clientes) — alimenta o select de "Cliente" de cada integração. */
  clientes: Array<{ id: number; nome: string }>
}

export default function MotoristaForm({ defaultValues, onSubmit, submitLabel, submittingLabel, clientes }: MotoristaFormProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<MotoristaComIntegracoesFormValues>({
    resolver: zodResolver(motoristaComIntegracoesSchema) as Resolver<MotoristaComIntegracoesFormValues>,
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "integracao",
  })

  const handleSubmit: SubmitHandler<MotoristaComIntegracoesFormValues> = async (dados) => {
    setErroGlobal("")

    try {
      const resposta = await onSubmit(dados)

      if (resposta.sucesso) {
        router.push("/motorista")
        return
      }

      setErroGlobal(resposta.erro ?? "Erro interno ao salvar o motorista.")
    } catch {
      setErroGlobal("Falha de comunicação com o servidor.")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: João da Silva" {...field} value={normalizeFormValue(field.value)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="cpf" render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    maxLength={14}
                    {...field}
                    value={formatarCpf(field.value || "")}
                    onChange={(evento) => field.onChange(somenteDigitosCpf(evento.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Motoristas cadastrados antes deste campo existir podem estar sem CPF — obrigatório para novos cadastros e edições.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="seva" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número SEVA</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 12345" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="diasTrabalhados" render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Jornada Atual</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={11} placeholder="Ex: 1 a 11" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormDescription>
                    1–6 = dias seguidos trabalhados · 7 = Folga · 8 = Férias · 9 = Exames · 10 = Interno · 11 = Manutenção
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="turno" render={({ field }) => (
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
            )} />

            <FormField control={form.control} name="liberado" render={({ field }) => (
              <FormItem>
                <FormLabel>Situação</FormLabel>
                <Select value={field.value ? "true" : "false"} onValueChange={(value) => field.onChange(value === "true")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a situação" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="true">Liberado</SelectItem>
                    <SelectItem value="false">Em treinamento (não liberado)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Não liberado fica de fora da sugestão automática e não pode ser motorista principal — só acompanhante.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="produtosAutorizados" render={({ field }) => {
              const selecionados: string[] = field.value ?? []

              return (
                <FormItem>
                  <FormLabel>Produtos Autorizados</FormLabel>
                  <FormDescription>
                    Gases que este motorista está certificado a transportar — a viagem só pode ser alocada a ele se o produto exigido estiver marcado aqui.
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRODUTO_OPCOES.map((opcao) => {
                      const marcado = selecionados.includes(opcao.valor)

                      return (
                        <label
                          key={opcao.valor}
                          className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
                        >
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={marcado}
                            onChange={(evento) => {
                              field.onChange(
                                evento.target.checked
                                  ? [...selecionados, opcao.valor]
                                  : selecionados.filter((valor) => valor !== opcao.valor),
                              )
                            }}
                          />
                          {opcao.label}
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }} />

          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-col gap-3 border-b bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Integrações</CardTitle>
              <CardDescription>Cadastre as integrações ativas do motorista para validação de alocação.</CardDescription>
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
                    aria-label="Remover integração"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <FormField
                    control={form.control}
                    name={`integracao.${index}.cliente` as Path<MotoristaComIntegracoesFormValues>}
                    render={({ field }) => (
                      <FormItem className="md:col-span-5">
                        <FormLabel>Cliente</FormLabel>
                        <Select
                          value={typeof field.value === "string" ? field.value : ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.nome}>
                                {cliente.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-40 shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            {form.formState.isSubmitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
