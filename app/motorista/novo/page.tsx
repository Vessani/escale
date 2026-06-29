'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, ArrowLeft } from "lucide-react"
import { criarMotorista } from "@/lib/actions/motoristas" 
import { normalizeFormValue } from "@/lib/form-utils"
import { motoristaBaseSchema, type MotoristaFormValues } from "@/lib/validation/motoristas"

export default function NovoMotoristaPage() {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")

  const form = useForm<MotoristaFormValues>({
   resolver: zodResolver(motoristaBaseSchema) as Resolver<MotoristaFormValues>,
   defaultValues: {
     nome: "",
     seva: 0,
      diasTrabalhados: 0,
      turno: "MANHA",
    },
  })

  const onSubmit: SubmitHandler<MotoristaFormValues> = async (dados) => {
    setErroGlobal("")

    const pacote = {
      ...dados,
      integracao: [],
    }

    try {
      const resposta = await criarMotorista(pacote)

      if (resposta.sucesso) {
        router.push("/motorista")
      } else {
        setErroGlobal(resposta.erro || "Erro interno ao salvar o motorista.")
      }
    } catch (error) {
      if (error instanceof Error) {
        setErroGlobal(error.message)
      } else {
        setErroGlobal("Falha de comunicação com o servidor.")
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="icon" 
            type="button" 
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Motorista</h1>
            <p className="text-slate-500 mt-1">Insira as informações operacionais do condutor.</p>
          </div>
        </div>
      </div>

      {erroGlobal && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-md font-medium">
          {erroGlobal}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormLabel>Dias Trabalhados</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 15" {...field} value={normalizeFormValue(field.value)} />
                    </FormControl>
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

            </CardContent>
          </Card>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-40 shadow-sm">
              <Save className="w-4 h-4 mr-2" />
              {form.formState.isSubmitting ? "A guardar..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}