import type { Metadata } from "next"
import { MotoristaEViagemAprovacao, PaginaAprovacao } from "@/components/aprovacao/pagina-aprovacao"
import { decidirUber } from "@/lib/actions/uber-publico"
import { buscarUberPorToken } from "@/lib/services/uber.service"
import { formatarMotivoUber } from "@/lib/services/uber-regras"
import { esquemaTokenLink } from "@/lib/validation/link-aprovacao"
import { formatarNomeProprio } from "@/lib/utils/texto"

/**
 * Página que o gestor abre pelo link do grupo de WhatsApp — pública, como a
 * do estouro (app/aprovar-estouro): abrir NUNCA decide nada, só o botão.
 */

export const metadata: Metadata = {
  title: "Aprovação de Uber",
  robots: { index: false, follow: false },
  // O token está na URL: não deixa ele vazar no cabeçalho Referer.
  referrer: "no-referrer",
}

export default async function AprovarUberPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pedido = esquemaTokenLink.safeParse(token).success ? await buscarUberPorToken(token) : null

  return (
    <PaginaAprovacao titulo="Pedido de Uber" token={token} pedido={pedido} decidir={decidirUber}>
      {pedido && (
        <>
          <MotoristaEViagemAprovacao motorista={formatarNomeProprio(pedido.motorista.nome)} viagem={pedido.viagem} />
          <dt className="text-muted-foreground">Origem</dt>
          <dd>{pedido.origem}</dd>
          <dt className="text-muted-foreground">Destino</dt>
          <dd>{pedido.destino}</dd>
          <dt className="text-muted-foreground">Motivo</dt>
          <dd className="font-medium">{formatarMotivoUber(pedido.motivo)}</dd>
        </>
      )}
    </PaginaAprovacao>
  )
}
