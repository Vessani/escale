'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, SubmitHandler, Resolver, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, PlusCircle, Save } from "lucide-react"
import { criarViagem } from "@/lib/actions/viagens"
import { normalizeFormValue } from "@/lib/form-utils"
import { STATUS_VIAGEM_OPCOES } from "@/lib/services/viagem-status.service"
import { novaViagemSchema, type NovaViagemFormValues } from "@/lib/validation/viagens"

export default function NovaViagemPage() {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<NovaViagemFormValues>({
    resolver: zodResolver(novaViagemSchema) as Resolver<NovaViagemFormValues>,
    defaultValues: {
      numViagem: "", 
      carreta: "", 
      cavalo: "", 
      tanque: "", 
      diasViagem: 1,
      inicioPrevisto: "", 
      fimPrevisto: "", 
      turno: "MANHA",
      status: "CRIADA",
      entregas: [
        { dataEntrega: "", cliente: "", cidade: "", uf: "", kg: 0, m3: 0, sapcode: "", codewhite: "", obs: "" }
      ]
    },
  })

  const { fields, append, remove } = useFieldArray({
    name: "entregas",
    control: form.control,
  })

  const onSubmit: SubmitHandler<NovaViagemFormValues> = async (dados) => {
    setErroGlobal("")
    
    const pacote = {
      ...dados,
      inicioPrevisto: new Date(dados.inicioPrevisto),
      fimPrevisto: new Date(dados.fimPrevisto),
      entregas: dados.entregas.map(e => ({
        ...e,
        dataEntrega: new Date(e.dataEntrega)
      }))
    }

    try {
      const resposta = await criarViagem(pacote)

      if (resposta.sucesso) {
        router.push("/viagens")
      } else {
        setErroGlobal(resposta.erro ?? "Ocorreu um erro desconhecido ao salvar a viagem.")
      }
    } catch (error) {
      if (error instanceof Error) {
        setErroGlobal(error.message)
      } else {
        setErroGlobal("Ocorreu um erro inesperado ao salvar a viagem.")
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nova Viagem</h1>
        <Button variant="outline" type="button" onClick={() => router.back()}>Cancelar</Button>
      </div>

      {erroGlobal && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-md font-medium">
          {erroGlobal}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Informações do Veículo e Rota</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <FormField control={form.control} name="numViagem" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº Viagem</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 10045" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />
              
              <FormField control={form.control} name="diasViagem" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (Dias)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="tanque" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanque</FormLabel>
                  <FormControl>
                    <Input placeholder="Num. Tanque" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="turno" render={({ field }) => (
                <FormItem>
                  <FormLabel>Turno Operacional</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MANHA">Manhã</SelectItem>
                      <SelectItem value="NOITE">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_VIAGEM_OPCOES.map((opcao) => (
                        <SelectItem key={opcao.valor} value={opcao.valor}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="cavalo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Cavalo / Truck)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 2024 ou 75" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="carreta" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Carreta)</FormLabel>
                  <FormControl>
                    <Input placeholder="0000 se for Truck" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="inicioPrevisto" render={({ field }) => (
                <FormItem>
                  <FormLabel>Início Previsto</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

              <FormField control={form.control} name="fimPrevisto" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim Previsto</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )} />

            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pontos de Entrega</CardTitle>
                <CardDescription>Adicione todas as paradas planejadas</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => append({ dataEntrega: "", cliente: "", cidade: "", uf: "", kg: 0, m3: 0, sapcode: "", codewhite: "", obs: "" })} 
                className="bg-white"
              >
                <PlusCircle className="w-4 h-4 mr-2" /> Nova Parada
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {form.formState.errors.entregas?.root && (
                <p className="text-red-500 text-sm font-medium">{form.formState.errors.entregas.root.message}</p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="relative p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Parada {index + 1}
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => remove(index)} 
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                    
                    <FormField control={form.control} name={`entregas.${index}.cliente` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Cliente</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do cliente" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name={`entregas.${index}.cidade` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Cidade" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.uf` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input maxLength={2} placeholder="Ex: SC" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.dataEntrega` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da Entrega</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.kg` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (Kg)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.m3` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cubagem (m³)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.sapcode` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>SAP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Código SAP" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.codewhite` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code White</FormLabel>
                        <FormControl>
                          <Input placeholder="Código CW" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`entregas.${index}.obs` as Path<NovaViagemFormValues>} render={({ field }) => (
                      <FormItem className="col-span-1 md:col-span-4">
                        <FormLabel>Observações da Entrega</FormLabel>
                        <FormControl>
                          <Input placeholder="Instruções de descarga, restrições de horário, etc." {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage/>
                      </FormItem>
                    )} />

                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="fixed bottom-0 left-64 right-0 p-4 bg-white border-t border-slate-200 flex justify-end shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-48 shadow-md">
              <Save className="w-4 h-4 mr-2" />
              {form.formState.isSubmitting ? "A processar..." : "Finalizar Viagem"}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  )
}