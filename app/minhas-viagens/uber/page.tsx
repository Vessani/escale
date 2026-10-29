import { CarTaxiFront } from "lucide-react"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarViagensAbertasDoMotorista } from "@/lib/services/estouro-jornada.service"
import { buscarSolicitacoesUber } from "@/lib/services/uber.service"
import { formatarMotivoUber } from "@/lib/services/uber-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { CartaoMeuPedido, TelaPedidoMotorista } from "@/components/aprovacao/pedido-motorista"
import { AcoesUber } from "@/components/uber/acoes-uber"
import { FormUber } from "@/components/uber/form-uber"

export const metadata = { title: "Pedir Uber" }

const DIAS_NA_LISTA = 7

/** Motorista pede o Uber e acompanha a resposta do gestor. `?viagem=ID` já vem da tela da viagem. */
export default async function MeuUberPage({ searchParams }: { searchParams: Promise<{ viagem?: string }> }) {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const [viagens, pedidos] = await Promise.all([
    buscarViagensAbertasDoMotorista(filialId, motoristaId),
    buscarSolicitacoesUber(filialId, DIAS_NA_LISTA, { motoristaId }),
  ])
  const viagemInicial = Number((await searchParams).viagem) || undefined

  return (
    <TelaPedidoMotorista
      icone={CarTaxiFront}
      titulo="Pedir Uber"
      descricao="O link vai pro grupo de WhatsApp da filial e o gestor aprova ou recusa por ele. Só chame o Uber depois de aprovado."
      formulario={<FormUber modo="motorista" viagens={viagens} viagemInicial={viagemInicial} voltarHref="/minhas-viagens" />}
      diasNaLista={DIAS_NA_LISTA}
    >
      {pedidos.map((p) => (
        <CartaoMeuPedido
          key={p.id}
          pedido={p}
          titulo={formatarMotivoUber(p.motivo)}
          detalhes={
            <>
              <p className="text-foreground/80">
                {p.origem} → {p.destino}
              </p>
              <p className="text-muted-foreground">pedido em {formatarDataHoraPtBr(p.criadoEm)}</p>
            </>
          }
          acoes={<AcoesUber id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} doMotorista />}
        />
      ))}
    </TelaPedidoMotorista>
  )
}
