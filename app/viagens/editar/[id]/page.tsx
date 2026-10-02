import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarChegadasDaViagem, buscarDespesasDaViagem, buscarViagemPorId } from "@/lib/queries/viagens"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes"
import { buscarHistoricoDaEntidade } from "@/lib/queries/auditoria"
import { calcularIntegracaoExigida } from "@/lib/services/alocacao.service"
import { montarOpcoesMotoristaPorViagem } from "@/lib/services/opcoes-motorista.service"
import { inicioDoDia } from "@/lib/utils/date-format"
import { notFound } from "next/navigation"
import FormEditarViagem from "./form-editar"
import { HistoricoCard } from "@/components/auditoria/historico-card"
import { serializeData } from "@/lib/serialization"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import { RegistroMotoristaCard } from "@/components/viagem/registro-motorista-card"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { TrocaMotoristaCard } from "@/components/viagem/troca-motorista-card"
import { buscarSubstitutosPossiveis, buscarTrocasDaViagem } from "@/lib/services/troca-motorista.service"

export default async function EditarViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viagemId = Number.parseInt(id, 10)

  if (Number.isNaN(viagemId)) {
    notFound()
  }

  const { filialId } = await requireSessaoPaginaComFilial()

  const viagem = await buscarViagemPorId(filialId, viagemId)

  if (!viagem) {
    notFound()
  }

  const [motoristas, numerosSapQueExigemIntegracao, historico, despesas, chegadas, trocas, substitutos] = await Promise.all([
    buscarMotoristasParaSelect(filialId),
    buscarNumerosSapQueExigemIntegracao(),
    buscarHistoricoDaEntidade("Viagem", viagem.id),
    buscarDespesasDaViagem(filialId, viagem.id),
    buscarChegadasDaViagem(filialId, viagem.id),
    buscarTrocasDaViagem(filialId, viagem.id),
    buscarSubstitutosPossiveis(filialId, viagem.motoristaId, viagem.produto),
  ])
  // Situação de cada motorista pra esta viagem calculada aqui no servidor —
  // o formulário recebe só id, nome, tipo e situação (ver montarOpcoesMotoristaPorViagem).
  const integracaoExigida =
    viagem.integracaoExigida ??
    calcularIntegracaoExigida(
      viagem.entregas.map((entrega) => ({ sapcode: entrega.sapcode ?? "" })),
      numerosSapQueExigemIntegracao,
    )
  const opcoesMotorista =
    montarOpcoesMotoristaPorViagem(motoristas, [{ ...viagem, integracaoExigida }], inicioDoDia(new Date())).get(viagem.id) ?? []

  const viagemSerializada = serializeData(viagem)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alocação e Edição</h1>
          <p className="text-muted-foreground mt-1">
            Revise os dados da viagem Nº {viagem.numViagem} e confirme o motorista alocado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link href={`/viagens/relatorio/${viagem.id}`}>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Relatório da viagem
          </Button>
        </Link>
        <Link href={`/api/viagens/${viagem.id}/excel`}>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </Link>
        </div>
      </div>

      <FormEditarViagem
        key={viagem.id}
        viagem={viagemSerializada}
        opcoesMotorista={opcoesMotorista}
        entregasComChegada={chegadas.map((chegada) => chegada.entregaId)}
      />

      <RegistroMotoristaCard
        kmInicial={viagem.kmInicial}
        kmFinal={viagem.kmFinal}
        despesas={despesas}
        chegadas={chegadas}
        problemaMecanico={viagem.problemaMecanico}
        problemaMecanicoEm={viagem.problemaMecanicoEm}
      />

      <TrocaMotoristaCard
        viagemId={viagem.id}
        numViagem={viagem.numViagem}
        emAndamento={STATUS_EM_ANDAMENTO.includes(viagem.status)}
        agoraServidor={new Date().toISOString()}
        kmInicial={viagem.kmInicial}
        substitutos={substitutos}
        trocas={trocas.map((troca) => ({
          id: troca.id,
          km: troca.km,
          trocadoEm: troca.trocadoEm.toISOString(),
          local: troca.local,
          motivo: troca.motivo,
          motoristaAnterior: troca.motoristaAnterior.nome,
          motoristaNovo: troca.motoristaNovo.nome,
        }))}
      />

      <HistoricoCard registros={serializeData(historico)} />
    </div>
  )
}