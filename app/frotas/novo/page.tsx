'use client'

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { criarFrota } from "@/lib/actions/frotas"
import FrotaForm from "@/components/frota/frota-form"

export default function NovaFrotaPage() {
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
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Novo Conjunto</h1>
            <p className="text-muted-foreground mt-1">Cadastre a frota (cavalo/carreta) e a disponibilidade dela.</p>
          </div>
        </div>
      </div>

      <FrotaForm
        defaultValues={{ cavalo: "", carreta: "", disponivelEm: "", emManutencao: false, tipoProduto: null }}
        onSubmit={criarFrota}
        submitLabel="Cadastrar"
        submittingLabel="Salvando..."
      />
    </div>
  )
}
