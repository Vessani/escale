import { BedDouble } from "lucide-react"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { buscarViagensAbertasDoMotorista } from "@/lib/services/estouro-jornada.service"
import { buscarSolicitacoesHotel } from "@/lib/services/hotel.service"
import { formatarDataPernoite } from "@/lib/services/hotel-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { CartaoMeuPedido, TelaPedidoMotorista } from "@/components/aprovacao/pedido-motorista"
import { AcoesHotel } from "@/components/hotel/acoes-hotel"
import { FormHotel } from "@/components/hotel/form-hotel"

export const metadata = { title: "Pedir hotel" }

const DIAS_NA_LISTA = 7

/** Motorista pede o hotel do pernoite e acompanha a resposta do gestor. `?viagem=ID` já vem da tela da viagem. */
export default async function MeuHotelPage({ searchParams }: { searchParams: Promise<{ viagem?: string }> }) {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const [viagens, pedidos] = await Promise.all([
    buscarViagensAbertasDoMotorista(filialId, motoristaId),
    buscarSolicitacoesHotel(filialId, DIAS_NA_LISTA, { motoristaId }),
  ])
  const viagemInicial = Number((await searchParams).viagem) || undefined

  return (
    <TelaPedidoMotorista
      icone={BedDouble}
      titulo="Pedir hotel (pernoite)"
      descricao="O link vai pro grupo de WhatsApp da filial e o gestor aprova ou recusa por ele. Só faça a reserva depois de aprovado."
      formulario={<FormHotel modo="motorista" viagens={viagens} viagemInicial={viagemInicial} voltarHref="/minhas-viagens" />}
      diasNaLista={DIAS_NA_LISTA}
    >
      {pedidos.map((p) => (
        <CartaoMeuPedido
          key={p.id}
          pedido={p}
          titulo={`${p.cidade} · ${formatarDataPernoite(p.dataPernoite)}`}
          detalhes={
            <>
              <p className="text-foreground/80">{p.nomeHotel}</p>
              <p className="text-muted-foreground">pedido em {formatarDataHoraPtBr(p.criadoEm)}</p>
            </>
          }
          acoes={<AcoesHotel id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} doMotorista />}
        />
      ))}
    </TelaPedidoMotorista>
  )
}
