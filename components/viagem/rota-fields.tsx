"use client"

import type { Control, FieldValues, Path } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { normalizeFormValue } from "@/lib/form-utils"
import { calcularDiasEntre } from "@/lib/utils/date-format"

type RotaFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
}

/** Calcula a duração a partir das datas; retorna null se alguma ainda não foi preenchida. */
function calcularDuracao(inicio: unknown, fim: unknown): number | null {
  if (typeof inicio !== "string" || typeof fim !== "string" || !inicio || !fim) {
    return null
  }

  const dataInicio = new Date(inicio)
  const dataFim = new Date(fim)

  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
    return null
  }

  return calcularDiasEntre(dataInicio, dataFim)
}

/**
 * Campos de rota comuns aos formulários de criar e editar viagem:
 * nº viagem, duração, cavalo, carreta, tanque, início e fim previstos.
 * Cada página mantém seu próprio Card e campos específicos (turno/status).
 */
export default function RotaFields<TFieldValues extends FieldValues>({ control }: RotaFieldsProps<TFieldValues>) {
  const nome = (campo: string) => campo as Path<TFieldValues>

  const inicioPrevisto = useWatch({ control, name: nome("inicioPrevisto") })
  const fimPrevisto = useWatch({ control, name: nome("fimPrevisto") })

  // Duração é só exibida aqui a partir de início/fim, pra não desincronizar do
  // intervalo real da viagem (era possível editar só esse número sem mudar as
  // datas). Não precisa ser escrita de volta no formulário: o servidor sempre
  // recalcula diasViagem a partir das datas reais (ver viagem-data-converter.service.ts),
  // então o valor enviado por aqui nunca é usado.
  const duracaoCalculada = calcularDuracao(inicioPrevisto, fimPrevisto)

  return (
    <>
      <FormField control={control} name={nome("numViagem")} render={({ field }) => (
        <FormItem>
          <FormLabel>Nº Viagem</FormLabel>
          <FormControl>
            <Input placeholder="Ex: 10045" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("diasViagem")} render={({ field }) => (
        <FormItem>
          <FormLabel>Duração (Dias)</FormLabel>
          <FormControl>
            <Input
              type="number"
              readOnly
              disabled
              className="bg-slate-50 text-slate-600"
              value={normalizeFormValue(duracaoCalculada ?? field.value)}
            />
          </FormControl>
          <FormDescription>Calculada automaticamente a partir do início e fim previstos.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("cavalo")} render={({ field }) => (
        <FormItem>
          <FormLabel>Frota (Cavalo)</FormLabel>
          <FormControl>
            <Input placeholder="Ex: 2024 ou 75" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("carreta")} render={({ field }) => (
        <FormItem>
          <FormLabel>Frota (Carreta)</FormLabel>
          <FormControl>
            <Input placeholder="0000 se for Truck" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("tanque")} render={({ field }) => (
        <FormItem>
          <FormLabel>Tanque</FormLabel>
          <FormControl>
            <Input placeholder="Num. Tanque" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("inicioPrevisto")} render={({ field }) => (
        <FormItem>
          <FormLabel>Início Previsto</FormLabel>
          <FormControl>
            <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={control} name={nome("fimPrevisto")} render={({ field }) => (
        <FormItem>
          <FormLabel>Fim Previsto</FormLabel>
          <FormControl>
            <Input type="datetime-local" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  )
}
