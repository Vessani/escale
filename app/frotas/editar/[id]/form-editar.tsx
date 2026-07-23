"use client"

import { editarFrota } from "@/lib/actions/frotas"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import FrotaForm from "@/components/frota/frota-form"
import type { FrotaFormValues } from "@/lib/validation/frotas"

type FrotaParaEditar = {
  id: number
  cavalo: string
  carreta: string
  disponivelEm: string | Date | null
}

type FormEditarFrotaProps = {
  frota: FrotaParaEditar
}

export default function FormEditarFrota({ frota }: FormEditarFrotaProps) {
  const handleSubmit = (dados: FrotaFormValues) => editarFrota(frota.id, dados)

  return (
    <FrotaForm
      defaultValues={{
        cavalo: frota.cavalo,
        carreta: frota.carreta,
        disponivelEm: frota.disponivelEm ? formatDateTimeForInput(frota.disponivelEm) : "",
      }}
      onSubmit={handleSubmit}
      submitLabel="Atualizar"
      submittingLabel="A guardar..."
    />
  )
}
