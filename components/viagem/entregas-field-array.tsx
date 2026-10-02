"use client"

import { useFieldArray, useWatch, type ArrayPath, type Control, type FieldValues, type Path } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { CircleCheck, PlusCircle, Trash2 } from "lucide-react"
import { normalizeFormValue } from "@/lib/form-utils"

const NOVA_ENTREGA_VAZIA = {
  dataEntrega: "",
  cliente: "",
  cidade: "",
  uf: "",
  kg: 0,
  m3: 0,
  sapcode: "",
  codewhite: "",
  obs: "",
}

type EntregasFieldArrayProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  mostrarCamposComplementares?: boolean
  /** Ids das entregas com chegada registrada pelo motorista: cliente/lugar travados e sem remover (ver trava-chegada.ts). */
  entregasComChegada?: number[]
}

const TEXTO_TRAVADA = "O motorista já registrou a chegada aqui. Pra mudar cliente ou lugar, apague a chegada em \"Registro do motorista\" (mais abaixo)."

export default function EntregasFieldArray<TFieldValues extends FieldValues>({
  control,
  mostrarCamposComplementares = false,
  entregasComChegada = [],
}: EntregasFieldArrayProps<TFieldValues>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "entregas" as ArrayPath<TFieldValues>,
  })

  const nomeCampo = (index: number, campo: string) => `entregas.${index}.${campo}` as Path<TFieldValues>
  // O `id` de `fields` é a chave do react-hook-form; o id da entrega vem dos valores.
  const valores = (useWatch({ control, name: "entregas" as Path<TFieldValues> }) ?? []) as Array<{ id?: number } | undefined>
  const travada = (index: number) => {
    const id = valores[index]?.id
    return id !== undefined && entregasComChegada.includes(id)
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-col gap-3 border-b bg-muted sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Pontos de Entrega</CardTitle>
          <CardDescription>Adicione todas as paradas planejadas</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(NOVA_ENTREGA_VAZIA as never)}
          className="bg-card"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Nova Parada
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {fields.map((field, index) => (
          <div key={field.id} className="relative p-4 border border-border rounded-lg bg-muted/50">
            <div className="absolute -top-3 left-4 bg-card px-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Parada {index + 1}
            </div>

            {travada(index) ? (
              <span
                title={TEXTO_TRAVADA}
                className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
              >
                <CircleCheck className="size-3.5" aria-hidden /> chegada registrada
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                aria-label="Remover entrega"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <FormField control={control} name={nomeCampo(index, "cliente")} render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} value={normalizeFormValue(field.value)} readOnly={travada(index)} title={travada(index) ? TEXTO_TRAVADA : undefined} className={travada(index) ? "bg-muted text-muted-foreground" : undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={control} name={nomeCampo(index, "cidade")} render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Cidade" {...field} value={normalizeFormValue(field.value)} readOnly={travada(index)} title={travada(index) ? TEXTO_TRAVADA : undefined} className={travada(index) ? "bg-muted text-muted-foreground" : undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={control} name={nomeCampo(index, "uf")} render={({ field }) => (
                <FormItem>
                  <FormLabel>UF</FormLabel>
                  <FormControl>
                    <Input maxLength={2} placeholder="Ex: SC" {...field} value={normalizeFormValue(field.value)} readOnly={travada(index)} title={travada(index) ? TEXTO_TRAVADA : undefined} className={travada(index) ? "bg-muted text-muted-foreground" : undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={control} name={nomeCampo(index, "dataEntrega")} render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da Entrega</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={control} name={nomeCampo(index, "kg")} render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso (Kg)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={control} name={nomeCampo(index, "m3")} render={({ field }) => (
                <FormItem>
                  <FormLabel>Cubagem (m³)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={normalizeFormValue(field.value)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {mostrarCamposComplementares && (
                <>
                  <FormField control={control} name={nomeCampo(index, "sapcode")} render={({ field }) => (
                    <FormItem>
                      <FormLabel>SAP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Código SAP" {...field} value={normalizeFormValue(field.value)} readOnly={travada(index)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={control} name={nomeCampo(index, "codewhite")} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code White</FormLabel>
                      <FormControl>
                        <Input placeholder="Código CW" {...field} value={normalizeFormValue(field.value)} readOnly={travada(index)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={control} name={nomeCampo(index, "obs")} render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-4">
                      <FormLabel>Observações da Entrega</FormLabel>
                      <FormControl>
                        <Input placeholder="Instruções de descarga, restrições de horário, etc." {...field} value={normalizeFormValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
