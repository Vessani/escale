"use client"

import { editarCliente } from "@/lib/actions/clientes"
import ClienteForm from "@/components/cliente/cliente-form"
import type { ClienteFormValues } from "@/lib/validation/clientes"

type ClienteParaEditar = {
  id: number
  nome: string
  numeroSap: string
  exigeIntegracao: boolean
}

type FormEditarClienteProps = {
  cliente: ClienteParaEditar
}

export default function FormEditarCliente({ cliente }: FormEditarClienteProps) {
  const handleSubmit = (dados: ClienteFormValues) => editarCliente(cliente.id, dados)

  return (
    <ClienteForm
      defaultValues={{
        nome: cliente.nome,
        numeroSap: cliente.numeroSap,
        exigeIntegracao: cliente.exigeIntegracao,
      }}
      onSubmit={handleSubmit}
      submitLabel="Atualizar"
      submittingLabel="Salvando..."
    />
  )
}
