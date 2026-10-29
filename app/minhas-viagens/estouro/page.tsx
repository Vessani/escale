import { Hourglass } from "lucide-react"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarEstouros, buscarViagensAbertasDoMotorista } from "@/lib/services/estouro-jornada.service"
import { formatarMinutos, formatarMotivos } from "@/lib/services/estouro-jornada-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { CartaoMeuPedido, TelaPedidoMotorista } from "@/components/aprovacao/pedido-motorista"
import { AcoesEstouro } from "@/components/estouro/acoes-estouro"
import { FormEstouro } from "@/components/estouro/form-estouro"

export const metadata = { title: "Estouro de jornada" }

const DIAS_NA_LISTA = 7

/** Motorista pede o estouro e acompanha a resposta do gestor. `?viagem=ID` já vem da tela da viagem. */
export default async function MeuEstouroPage({ searchParams }: { searchParams: Promise<{ viagem?: string }> }) {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const [viagens, pedidos] = await Promise.all([
    buscarViagensAbertasDoMotorista(filialId, motoristaId),
    buscarEstouros(filialId, DIAS_NA_LISTA, { motoristaId }),
  ])
  const viagemInicial = Number((await searchParams).viagem) || undefined

  return (
    <TelaPedidoMotorista
      icone={Hourglass}
      titulo="Pedir estouro de jornada"
      descricao="O link vai pro grupo de WhatsApp da filial e o gestor aprova ou recusa por ele."
      formulario={<FormEstouro modo="motorista" viagens={viagens} viagemInicial={viagemInicial} voltarHref="/minhas-viagens" />}
      diasNaLista={DIAS_NA_LISTA}
    >
      {pedidos.map((p) => (
        <CartaoMeuPedido
          key={p.id}
          pedido={{ ...p, numViagem: p.viagem?.numViagem }}
          titulo={formatarMinutos(p.minutosExtras)}
          detalhes={
            <p className="text-muted-foreground">
              {formatarMotivos(p.motivos)} · pedido em {formatarDataHoraPtBr(p.criadoEm)}
            </p>
          }
          acoes={<AcoesEstouro id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} doMotorista />}
        />
      ))}
    </TelaPedidoMotorista>
  )
}
