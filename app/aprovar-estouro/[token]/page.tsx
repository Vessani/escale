import type { Metadata } from "next"
import { PaginaAprovacao } from "@/components/aprovacao/pagina-aprovacao"
import { decidirEstouro } from "@/lib/actions/estouro-jornada-publico"
import { buscarEstouroPorToken } from "@/lib/services/estouro-jornada.service"
import { formatarMinutos, formatarMotivos } from "@/lib/services/estouro-jornada-regras"
import { esquemaTokenLink } from "@/lib/validation/link-aprovacao"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"

/**
 * Página que o gestor abre pelo link do grupo de WhatsApp — pública (fora do
 * proxy de login, ver proxy.ts). Abrir NUNCA decide nada: o WhatsApp carrega
 * o link sozinho pra montar a prévia. A decisão só acontece no botão.
 * (Sempre dinâmica: lê o token dos params e o banco a cada acesso.)
 */

export const metadata: Metadata = {
  title: "Aprovação de estouro de jornada",
  robots: { index: false, follow: false },
  // O token está na URL: não deixa ele vazar no cabeçalho Referer.
  referrer: "no-referrer",
}

export default async function AprovarEstouroPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const estouro = esquemaTokenLink.safeParse(token).success ? await buscarEstouroPorToken(token) : null

  return (
    <PaginaAprovacao titulo="Estouro de jornada" token={token} pedido={estouro} decidir={decidirEstouro}>
      {estouro && (
        <>
          <dt className="text-muted-foreground">Motorista</dt>
          <dd className="font-medium">{formatarNomeProprio(estouro.motorista.nome)}</dd>
          {estouro.viagem && (
            <>
              <dt className="text-muted-foreground">Viagem</dt>
              <dd className="font-mono tabular-nums">
                {estouro.viagem.numViagem}
                <span className="block font-sans text-xs text-muted-foreground">
                  {formatarDataHoraPtBr(estouro.viagem.inicioPrevisto)} → {formatarDataHoraPtBr(estouro.viagem.fimPrevisto)}
                </span>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Horas extras</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatarMinutos(estouro.minutosExtras)}</dd>
          <dt className="text-muted-foreground">Motivos</dt>
          <dd>{formatarMotivos(estouro.motivos)}</dd>
        </>
      )}
    </PaginaAprovacao>
  )
}
