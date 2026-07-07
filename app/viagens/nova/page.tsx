'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save } from "lucide-react"
import { criarViagem, criarViagensEmLote } from "@/lib/actions/viagens"
import { STATUS_VIAGEM_OPCOES } from "@/lib/services/viagem-status.service"
import { novaViagemSchema, type NovaViagemFormValues } from "@/lib/validation/viagens"
import type { ResultadoImportacaoLote } from "@/lib/types/types"
import UploadXLSXViagem from "@/components/viagem/upload-xlsx-viagem"
import RotaFields from "@/components/viagem/rota-fields"
import EntregasFieldArray from "@/components/viagem/entregas-field-array"

export default function NovaViagemPage() {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")
  const [resumoLote, setResumoLote] = useState<ResultadoImportacaoLote | null>(null)

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

  const handleDataLoaded = (dados: NovaViagemFormValues) => {
    setResumoLote(null)
    form.reset(dados)
  }

  const handleImportarLote = async (viagens: NovaViagemFormValues[]) => {
    setErroGlobal("")
    setResumoLote(null)

    try {
      const resposta = await criarViagensEmLote(viagens)
      setResumoLote(resposta)

      if (resposta.sucesso) {
        router.push("/viagens/alocacao")
      }
    } catch {
      setErroGlobal("Ocorreu um erro inesperado ao importar as viagens.")
    }
  }

  const onSubmit: SubmitHandler<NovaViagemFormValues> = async (dados) => {
    setErroGlobal("")

    // Os dados já vêm no formato correto do formulário
    // Não precisa converter novamente, o tipo NovaViagemInput aceita string | Date
    try {
      const resposta = await criarViagem(dados)

      if (resposta.sucesso) {
        router.push("/viagens")
      } else {
        setErroGlobal(resposta.erro ?? "Ocorreu um erro desconhecido ao salvar a viagem.")
      }
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : "Ocorreu um erro inesperado ao salvar a viagem."
      setErroGlobal(mensagem)
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

      {resumoLote && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">
            {resumoLote.criadas} viagem(ns) criada(s) com sucesso.
            {resumoLote.falhas.length > 0 && ` ${resumoLote.falhas.length} falharam:`}
          </p>
          {resumoLote.falhas.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {resumoLote.falhas.map((falha) => (
                <li key={falha.numViagem}>
                  Viagem {falha.numViagem} — {falha.erro}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <UploadXLSXViagem
        onDataLoaded={handleDataLoaded}
        onError={setErroGlobal}
        onImportarLote={handleImportarLote}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Informações do Veículo e Rota</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              <RotaFields control={form.control} />

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
            </CardContent>
          </Card>

          {form.formState.errors.entregas?.root && (
            <p className="text-red-500 text-sm font-medium">{form.formState.errors.entregas.root.message}</p>
          )}

          <EntregasFieldArray control={form.control} mostrarCamposComplementares />

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
