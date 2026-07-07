'use client'

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { criarMotorista } from "@/lib/actions/motoristas"
import MotoristaForm from "@/components/motorista/motorista-form"
import type { MotoristaComIntegracoesFormValues } from "@/lib/validation/motoristas"

export default function NovoMotoristaPage() {
  const router = useRouter()

  const handleSubmit = async (dados: MotoristaComIntegracoesFormValues) => {
    const pacote = {
      ...dados,
      integracao: dados.integracao.map((integracao) => ({
        cliente: integracao.cliente,
        dataValidade: new Date(integracao.dataValidade),
        status: integracao.status,
      })),
    }

    return criarMotorista(pacote)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Motorista</h1>
            <p className="text-slate-500 mt-1">Insira as informações operacionais do condutor.</p>
          </div>
        </div>
      </div>

      <MotoristaForm
        defaultValues={{
          nome: "",
          seva: 0,
          diasTrabalhados: 1,
          turno: "MANHA",
          integracao: [],
        }}
        onSubmit={handleSubmit}
        submitLabel="Cadastrar"
        submittingLabel="A guardar..."
      />
    </div>
  )
}
