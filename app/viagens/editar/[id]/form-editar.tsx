"use client"

import type { StatusViagem, TipoProduto } from "@prisma/client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type Resolver, type SubmitHandler } from "react-hook-form"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { editarViagem } from "@/lib/actions/viagens"
import type { EditarViagemInput } from "@/lib/types/types"
import { calcularIntegracaoExigida, motoristaEhCompativel } from "@/lib/services/alocacao.service"
import { mapearRegistrosJornada } from "@/lib/services/jornada.service"
import {
  STATUS_VIAGEM_OPCOES,
  formatarStatusViagem,
  normalizarStatusViagem,
} from "@/lib/services/viagem-status.service"
import { classeBadgeStatusViagem } from "../../badge-styles"
import { Save, UserCheck } from "lucide-react"
import { formatDateTimeForInput, inicioDoDia } from "@/lib/utils/date-format"
import { rotularMotoristaParaSelect } from "@/lib/utils/motorista-format"
import { PRODUTO_OPCOES } from "@/lib/services/produto.service"
import { editarViagemSchema, type EditarViagemFormValues } from "@/lib/validation/viagens"
import RotaFields from "@/components/viagem/rota-fields"
import EntregasFieldArray from "@/components/viagem/entregas-field-array"

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
  liberado: boolean
  disponivel: boolean
  integracao: Array<{
    cliente: string
    status: "ATIVO" | "INATIVO" | "PENDENTE"
    dataValidade: string | Date
  }>
  registrosJornada: Array<{
    data: string | Date
    codigo: number
  }>
  jornadaRelatorioInicio: string | Date | null
  jornadaRelatorioFim: string | Date | null
  produtosAutorizados: TipoProduto[]
}

type ViagemComRelacionamentos = {
  id: number
  numViagem: string
  carreta: string
  cavalo: string
  tanque: string
  diasViagem: number
  turno: EditarViagemFormValues["turno"]
  produto: TipoProduto | null
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
  inicioPrevisto: string | Date
  fimPrevisto: string | Date
  status: StatusViagem
  integracaoExigida: string | null
  viagemExtra: boolean
  entregas: EntregaFormModel[]
}

type FormEditarViagemProps = {
  viagem: ViagemComRelacionamentos
  motoristas: MotoristaParaSelect[]
  numerosSapQueExigemIntegracao: string[]
}

export default function FormEditarViagem({ viagem, motoristas, numerosSapQueExigemIntegracao }: FormEditarViagemProps) {
  const router = useRouter()
  const [erroGlobal, setErroGlobal] = useState("")
  const integracaoExigida = viagem.integracaoExigida ?? calcularIntegracaoExigida(
    viagem.entregas.map((entrega) => ({ sapcode: entrega.sapcode ?? "" })),
    new Set(numerosSapQueExigemIntegracao),
  )
  const statusInicial = normalizarStatusViagem(viagem.status)
  // "Hoje" do navegador — essa checagem é só um aviso na seleção manual (ver
  // texto de ajuda abaixo), não é reforçada no servidor, então não precisa
  // vir do servidor.
  const hoje = useMemo(() => inicioDoDia(new Date()), [])

  const form = useForm<EditarViagemFormValues>({
    resolver: zodResolver(editarViagemSchema) as Resolver<EditarViagemFormValues>,
    defaultValues: {
      numViagem: viagem.numViagem,
      carreta: viagem.carreta,
      cavalo: viagem.cavalo,
      tanque: viagem.tanque,
      diasViagem: viagem.diasViagem,
      turno: viagem.turno,
      produto: viagem.produto ?? undefined,
      viagemExtra: viagem.viagemExtra,
      motoristaId: viagem.motoristaId,
      motoristaAcompanhanteId: viagem.motoristaAcompanhanteId,
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

  const statusSelecionado = useWatch({ control: form.control, name: "status" })

  const onSubmit: SubmitHandler<EditarViagemFormValues> = async (dados) => {
    setErroGlobal("")

    // inicioPrevisto/fimPrevisto/dataEntrega ficam como string (o formato de
    // <input type="datetime-local">, sem timezone) — convertê-los aqui pra
    // Date usaria o fuso do navegador; melhor deixar o servidor interpretar
    // com o fuso de Brasília fixo (ver converterEntradaDeDataHora).
    const pacote: EditarViagemInput = {
      ...dados,
      motoristaId: dados.motoristaId ?? null,
      motoristaAcompanhanteId: dados.motoristaAcompanhanteId ?? null,
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
        {erroGlobal && <Alert variant="error" className="font-medium">{erroGlobal}</Alert>}

        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg text-blue-900">Alocação de Motorista</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                          const compativel = motoristaEhCompativel(
                            {
                              ...motorista,
                              registrosJornada: mapearRegistrosJornada(motorista.registrosJornada),
                            },
                            {
                              turnoViagem: viagem.turno,
                              diasViagem: viagem.diasViagem,
                              dataInicioViagem: new Date(viagem.inicioPrevisto),
                              integracaoExigida,
                              produtoExigido: viagem.produto,
                              hoje,
                            },
                          )

                          const rotulo = rotularMotoristaParaSelect(compativel, motorista.disponivel)

                          return (
                            <SelectItem key={motorista.id} value={String(motorista.id)}>
                              {motorista.nome} {rotulo}
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                  Aceita exceções de emergência (turno, integração, jornada ou descanso fora da regra) — nada é bloqueado automaticamente, confira o aviso antes de confirmar.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="motoristaAcompanhanteId"
              render={({ field }) => (
                <FormItem className="max-w-md mt-4">
                  <FormLabel>Motorista Acompanhante (opcional)</FormLabel>
                  <Select
                    value={field.value === null || field.value === undefined ? "nenhum" : String(field.value)}
                    onValueChange={(value) => field.onChange(value === "nenhum" ? null : Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Nenhum acompanhante..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum acompanhante</SelectItem>
                      {motoristas.map((motorista) => (
                        <SelectItem key={motorista.id} value={String(motorista.id)}>
                          {motorista.nome} {!motorista.liberado && "(Em treinamento)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Vaga extra sem checagem de compatibilidade — aceita qualquer motorista, inclusive em treinamento. Só bloqueia se ele já estiver em outra viagem no período.
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
            <RotaFields control={form.control} />

            <FormField
              control={form.control}
              name="produto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUTO_OPCOES.map((opcao) => (
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

            <FormField
              control={form.control}
              name="viagemExtra"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0 self-end pb-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    Viagem extra (fora da programação)
                  </FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <EntregasFieldArray control={form.control} />

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex justify-end border-t border-slate-200 bg-white p-4 shadow-md md:-mx-8 md:-mb-8">
          <Button type="button" variant="outline" className="mr-3" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-48">
            <Save className="mr-2 h-4 w-4" />
            {form.formState.isSubmitting ? "Processando..." : "Atualizar Viagem"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
