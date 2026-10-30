import type { Metadata } from "next"
import { MotoristaEViagemAprovacao, PaginaAprovacao } from "@/components/aprovacao/pagina-aprovacao"
import { decidirHotel } from "@/lib/actions/hotel-publico"
import { buscarHotelPorToken } from "@/lib/services/hotel.service"
import { formatarDataPernoite } from "@/lib/services/hotel-regras"
import { esquemaTokenLink } from "@/lib/validation/link-aprovacao"
import { formatarNomeProprio } from "@/lib/utils/texto"

/**
 * Página que o gestor abre pelo link do grupo de WhatsApp — pública, como a
 * do Uber e a do estouro (app/aprovar-uber, app/aprovar-estouro): abrir
 * NUNCA decide nada, só o botão.
 */

export const metadata: Metadata = {
  title: "Aprovação de hotel",
  robots: { index: false, follow: false },
  // O token está na URL: não deixa ele vazar no cabeçalho Referer.
  referrer: "no-referrer",
}

export default async function AprovarHotelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pedido = esquemaTokenLink.safeParse(token).success ? await buscarHotelPorToken(token) : null

  return (
    <PaginaAprovacao titulo="Pedido de hotel (pernoite)" token={token} pedido={pedido} decidir={decidirHotel}>
      {pedido && (
        <>
          <MotoristaEViagemAprovacao motorista={formatarNomeProprio(pedido.motorista.nome)} viagem={pedido.viagem} />
          <dt className="text-muted-foreground">Cidade</dt>
          <dd className="font-medium">{pedido.cidade}</dd>
          <dt className="text-muted-foreground">Pernoite</dt>
          <dd className="font-medium tabular-nums">{formatarDataPernoite(pedido.dataPernoite)}</dd>
          <dt className="text-muted-foreground">Hotel</dt>
          <dd>{pedido.nomeHotel}</dd>
        </>
      )}
    </PaginaAprovacao>
  )
}
