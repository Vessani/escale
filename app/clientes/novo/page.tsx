'use client'

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { criarCliente } from "@/lib/actions/clientes"
import ClienteForm from "@/components/cliente/cliente-form"

export default function NovoClientePage() {
  const router = useRouter()

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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Cliente</h1>
            <p className="text-slate-500 mt-1">Cadastre o nome exato usado nas entregas e integrações.</p>
          </div>
        </div>
      </div>

      <ClienteForm
        defaultValues={{ nome: "", numeroSap: "", exigeIntegracao: false }}
        onSubmit={criarCliente}
        submitLabel="Cadastrar"
        submittingLabel="Salvando..."
      />
    </div>
  )
}
