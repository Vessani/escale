"use client"

import type { StatusViagem } from "@prisma/client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch, type Path, type Resolver, type SubmitHandler } from "react-hook-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { editarViagem } from "@/lib/actions/viagens"
import type { EditarViagemInput } from "@/lib/types/types"
import { calcularIntegracaoExigida, motoristaEhCompativel } from "@/lib/services/alocacao.service"
import {
  STATUS_VIAGEM_OPCOES,
  formatarStatusViagem,
  normalizarStatusViagem,
} from "@/lib/services/viagem-status.service"
import { classeBadgeStatusViagem } from "../../badge-styles"
import { PlusCircle, Save, Trash2, UserCheck } from "lucide-react"
import { formatDateTimeForInput, normalizeFormValue } from "@/lib/form-utils"
import { editarViagemSchema, type EditarViagemFormValues } from "@/lib/validation/viagens"

type EntregaFormModel = {
  id: number
  dataEntrega: string | Date
  cliente: string
  cidade: string
  uf: string
  kg: number
  m3: number
  sapcode: string | null
  codewhite: string | null
  obs: string | null
}

type MotoristaParaSelect = {
  id: number
  nome: string
  turno: EditarViagemFormValues["turno"]
  diasTrabalhados: number
  integracao: Array<{
    cliente: string
    status: "ATIVO" | "INATIVO" | "PENDENTE"
    dataValidade: string | Date
  }>
}

type ViagemComRelacionamentos = {
  id: number
  numViagem: string
  carreta: string
  cavalo: string
  tanque: string
  diasViagem: number
  turno: EditarViagemFormValues["turno"]
  motoristaId: number | null
  inicioPrevisto: string | Date
  fimPrevisto: string | Date
  status: StatusViagem
  integracaoExigida: string | null
  entregas: EntregaFormModel[]
}

type FormEditarViagemProps = {
  viagem: ViagemComRelacionamentos
  motoristas: MotoristaParaSelect[]
}

export default function FormEditarViagem({ viagem, motoristas }: FormEditarViagemProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")
  const integracaoExigida = viagem.integracaoExigida ?? calcularIntegracaoExigida(viagem.entregas)
  const statusInicial = normalizarStatusViagem(viagem.status)

  const form = useForm<EditarViagemFormValues>({
    resolver: zodResolver(editarViagemSchema) as Resolver<EditarViagemFormValues>,
    defaultValues: {
      numViagem: viagem.numViagem,
      carreta: viagem.carreta,
      cavalo: viagem.cavalo,
      tanque: viagem.tanque,
      diasViagem: viagem.diasViagem,
      turno: viagem.turno,
      motoristaId: viagem.motoristaId,
      inicioPrevisto: formatDateTimeForInput(viagem.inicioPrevisto),
      fimPrevisto: formatDateTimeForInput(viagem.fimPrevisto),
      status: statusInicial,
      entregas: viagem.entregas.map((entrega) => ({
        id: entrega.id,
        dataEntrega: formatDateTimeForInput(entrega.dataEntrega),
        cliente: entrega.cliente,
        cidade: entrega.cidade,
        uf: entrega.uf,
        kg: Number(entrega.kg),
        m3: Number(entrega.m3),
        sapcode: entrega.sapcode ?? "",
        codewhite: entrega.codewhite ?? "",
        obs: entrega.obs ?? "",
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    name: "entregas",
    control: form.control,
  })
  const statusSelecionado = useWatch({ control: form.control, name: "status" })

  const onSubmit: SubmitHandler<EditarViagemFormValues> = async (dados) => {
    setErroGlobal("")

    const pacote: EditarViagemInput = {
      ...dados,
      motoristaId: dados.motoristaId ?? null,
      inicioPrevisto: new Date(dados.inicioPrevisto),
      fimPrevisto: new Date(dados.fimPrevisto),
      entregas: dados.entregas.map((entrega) => ({
        ...entrega,
        dataEntrega: new Date(entrega.dataEntrega),
      })),
    }

    try {
      const resposta = await editarViagem(viagem.id, pacote)

      if (resposta.sucesso) {
        router.push("/viagens")
        return
      }

      setErroGlobal(resposta.erro ?? "Ocorreu um erro ao salvar a edição.")
    } catch {
      setErroGlobal("Ocorreu um erro inesperado de comunicação.")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {erroGlobal && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 font-medium text-red-600">
            {erroGlobal}
          </div>
        )}

        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-blue-100 bg-blue-50 py-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg text-blue-900">Alocação de Motorista</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={classeBadgeStatusViagem(statusSelecionado ?? "CRIADA")}>
                {formatarStatusViagem(statusSelecionado ?? "CRIADA")}
              </Badge>
              {viagem.integracaoExigida && (
                <Badge variant="outline" className="border-yellow-300 bg-yellow-100 text-yellow-800">
                  Exige Integração: {viagem.integracaoExigida}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="motoristaId"
              render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormLabel>Condutor Responsável (Turno preferencial: {viagem.turno})</FormLabel>
                  <Select
                    value={field.value === null || field.value === undefined ? "" : String(field.value)}
                    onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione um motorista compatível..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {motoristas.length === 0 ? (
                        <SelectItem value="0" disabled>
                          Nenhum motorista disponível
                        </SelectItem>
                      ) : (
                        motoristas.map((motorista) => {
                          const compativel = motoristaEhCompativel(motorista, {
                            turnoViagem: viagem.turno,
                            diasViagem: viagem.diasViagem,
                            dataInicioViagem: new Date(viagem.inicioPrevisto),
                            integracaoExigida,
                          })

                          return (
                            <SelectItem key={motorista.id} value={String(motorista.id)}>
                              {motorista.nome} {compativel ? "(Compatível)" : "(Emergência - fora da regra)"}
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                  A seleção manual aceita exceções para emergência; a alocação automática sempre respeita turno, integração e jornada.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="max-w-md mt-4">
                  <FormLabel>Status da viagem</FormLabel>
                  <Select value={field.value ?? "CRIADA"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_VIAGEM_OPCOES.map((opcao) => (
                        <SelectItem key={opcao.valor} value={opcao.valor}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-lg">Informações da Rota</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-4">
            <FormField
              control={form.control}
              name="numViagem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº Viagem</FormLabel>
                  <FormControl>
                    <Input {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diasViagem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (Dias)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cavalo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Cavalo)</FormLabel>
                  <FormControl>
                    <Input {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="carreta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frota (Carreta)</FormLabel>
                  <FormControl>
                    <Input {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tanque"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanque</FormLabel>
                  <FormControl>
                    <Input {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inicioPrevisto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Início Previsto</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fimPrevisto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim Previsto</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50">
            <CardTitle className="text-lg">Pontos de Entrega</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  dataEntrega: "",
                  cliente: "",
                  cidade: "",
                  uf: "",
                  kg: 0,
                  m3: 0,
                  sapcode: "",
                  codewhite: "",
                  obs: "",
                })
              }
              className="bg-white"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Parada
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {fields.map((field, index) => (
              <div key={field.id} className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="absolute right-2 top-2 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <FormField
                    control={form.control}
                    name={`entregas.${index}.cliente` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
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
                    name={`entregas.${index}.cidade` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`entregas.${index}.uf` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input maxLength={2} {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`entregas.${index}.dataEntrega` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da Entrega</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`entregas.${index}.kg` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (Kg)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`entregas.${index}.m3` as Path<EditarViagemFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cubagem (m³)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-64 right-0 flex justify-end border-t border-slate-200 bg-white p-4 shadow-md">
          <Button type="button" variant="outline" className="mr-3" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-48 bg-blue-600 hover:bg-blue-700">
            <Save className="mr-2 h-4 w-4" />
            {form.formState.isSubmitting ? "A processar..." : "Atualizar Viagem"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
