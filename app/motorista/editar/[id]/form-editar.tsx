"use client"

import { editarMotorista } from "@/lib/actions/motoristas"
import type { EditarMotoristaInput } from "@/lib/types/types"
import { formatDateForDateInput } from "@/lib/utils/date-format"
import MotoristaForm from "@/components/motorista/motorista-form"
import type { MotoristaComIntegracoesFormValues } from "@/lib/validation/motoristas"

type IntegracaoFormModel = {
  id: number
  cliente: string
  dataValidade: string | Date
  status: MotoristaComIntegracoesFormValues["integracao"][number]["status"]
}

type MotoristaComIntegracoes = {
  id: number
  nome: string
  seva: number
  diasTrabalhados: number
  turno: MotoristaComIntegracoesFormValues["turno"]
  integracao: IntegracaoFormModel[]
}

type FormEditarMotoristaProps = {
  motorista: MotoristaComIntegracoes
}

export default function FormEditarMotorista({ motorista }: FormEditarMotoristaProps) {
  const handleSubmit = async (dados: MotoristaComIntegracoesFormValues) => {
    const pacote: EditarMotoristaInput = {
      ...dados,
      integracao: dados.integracao.map((integracao) => ({
        id: integracao.id,
        cliente: integracao.cliente,
        dataValidade: new Date(integracao.dataValidade),
        status: integracao.status,
      })),
    }

    return editarMotorista(motorista.id, pacote)
  }

  return (
    <MotoristaForm
      defaultValues={{
        nome: motorista.nome,
        seva: motorista.seva,
        diasTrabalhados: motorista.diasTrabalhados,
        turno: motorista.turno,
        integracao: motorista.integracao.map((integracao) => ({
          id: integracao.id,
          cliente: integracao.cliente,
          dataValidade: formatDateForDateInput(integracao.dataValidade),
          status: integracao.status,
        })),
      }}
      onSubmit={handleSubmit}
      submitLabel="Atualizar"
      submittingLabel="A guardar..."
    />
  )
}
