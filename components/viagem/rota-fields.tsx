"use client"

import type { Control, FieldValues, Path } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { normalizeFormValue } from "@/lib/form-utils"

type RotaFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
}

/**
 * Campos de rota comuns aos formulários de criar e editar viagem:
 * nº viagem, duração, cavalo, carreta, tanque, início e fim previstos.
 * Cada página mantém seu próprio Card e campos específicos (turno/status).
 */
export default function RotaFields<TFieldValues extends FieldValues>({ control }: RotaFieldsProps<TFieldValues>) {
  const nome = (campo: string) => campo as Path<TFieldValues>

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
            <Input type="number" {...field} value={normalizeFormValue(field.value)} />
          </FormControl>
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
