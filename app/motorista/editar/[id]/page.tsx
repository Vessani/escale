import { notFound } from "next/navigation"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarClientes } from "@/lib/queries/clientes"
import { buscarHistoricoDaEntidade } from "@/lib/queries/auditoria"
import FormEditarMotorista from "./form-editar"
import { HistoricoCard } from "@/components/auditoria/historico-card"
import { veHistorico } from "@/lib/papeis"
import { serializeData } from "@/lib/serialization"
import { prepararJornadaDoMotorista, situacaoDoDia } from "@/lib/services/jornada.service"
import { buscarCoberturaRelatorioJornada } from "@/lib/queries/filiais"
import { inicioDoDia } from "@/lib/utils/date-format"
import { AcessoMotoristaCard } from "@/components/motorista/acesso-motorista-card"
import { situacaoAcessoMotorista } from "@/lib/services/acesso-motorista.service"

export default async function EditarMotoristaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const motoristaId = Number.parseInt(id, 10)

  if (Number.isNaN(motoristaId)) {
    notFound()
  }

  const { filialId, session } = await requireSessaoPaginaComFilial(undefined, { destinoDaTorre: "/motorista" })
  const verHistorico = veHistorico(session.user.role)

  const [motorista, clientes, historico, acesso, coberturaRelatorio] = await Promise.all([
    buscarMotoristaPorId(filialId, motoristaId),
    buscarClientes(),
    verHistorico ? buscarHistoricoDaEntidade("Motorista", motoristaId) : null,
    situacaoAcessoMotorista(filialId, motoristaId),
    buscarCoberturaRelatorioJornada(filialId),
  ])

  if (!motorista) {
    notFound()
  }

  // O campo de jornada do formulário mostra o código de hoje.
  const hoje = inicioDoDia(new Date())
  const jornada = prepararJornadaDoMotorista({ ...motorista, filial: { relatorioJornadaAte: coberturaRelatorio } })
  const { codigo: codigoHoje } = situacaoDoDia(jornada, hoje, hoje)

  const motoristaSerializado = serializeData({ ...motorista, codigoHoje })

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar Motorista</h1>
        <p className="text-muted-foreground mt-1">Atualize os dados operacionais do condutor.</p>
      </div>
      <FormEditarMotorista key={motorista.id} motorista={motoristaSerializado} clientes={clientes} />

      <AcessoMotoristaCard motoristaId={motorista.id} seva={motorista.seva} situacao={acesso} />

      {historico && <HistoricoCard registros={serializeData(historico)} />}
    </div>
  )
}
