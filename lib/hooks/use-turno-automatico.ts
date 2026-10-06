"use client"

import { useEffect, useRef } from "react"
import { useWatch, type Control, type FieldValues, type Path, type PathValue, type UseFormSetValue } from "react-hook-form"
import { turnoPorHorario } from "@/lib/services/turno"

/**
 * Quando o início previsto muda no formulário, o turno acompanha (Noite
 * das 16:00 às 03:59). Continua dando pra trocar o turno à mão depois — só
 * uma nova mudança no início recalcula. O valor inicial não dispara.
 */
export function useTurnoAutomatico<T extends FieldValues>(control: Control<T>, setValue: UseFormSetValue<T>) {
  const inicio = useWatch({ control, name: "inicioPrevisto" as Path<T> }) as unknown as string | undefined
  const anterior = useRef(inicio)

  useEffect(() => {
    if (anterior.current === inicio) return
    anterior.current = inicio
    const turno = inicio ? turnoPorHorario(inicio) : null
    if (turno) setValue("turno" as Path<T>, turno as PathValue<T, Path<T>>, { shouldDirty: true })
  }, [inicio, setValue])
}
