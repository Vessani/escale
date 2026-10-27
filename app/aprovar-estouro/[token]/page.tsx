import type { Metadata } from "next"
import { CheckCircle2, Clock, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Rodape } from "@/components/layout/rodape"
import { buscarEstouroPorToken } from "@/lib/services/estouro-jornada.service"
import { formatarMinutos, formatarMotivos } from "@/lib/services/estouro-jornada-regras"
import { esquemaTokenEstouro } from "@/lib/validation/estouro-jornada"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { DecisaoEstouro } from "./decisao-estouro"

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
  const estouro = esquemaTokenEstouro.safeParse(token).success ? await buscarEstouroPorToken(token) : null

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md flex-1 space-y-4">
        {!estouro ? (
          <Aviso
            icone={<XCircle className="w-6 h-6 text-destructive" aria-hidden />}
            titulo="Link inválido"
            texto="Este link não existe ou foi substituído por um mais novo. Peça a quem fez o pedido para enviar outro."
          />
        ) : (
          <Card className="shadow-sm">
            <CardHeader className="bg-muted border-b">
              <CardTitle className="text-lg">Estouro de jornada</CardTitle>
              <CardDescription>
                {estouro.filial.nome} · pedido por {estouro.solicitadoPorNome ?? "escalador"} em {formatarDataHoraPtBr(estouro.criadoEm)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
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
              </dl>

              {estouro.situacao === "PENDENTE" && <DecisaoEstouro token={token} expiraEm={formatarDataHoraPtBr(estouro.expiraEm)} />}
              {(estouro.situacao === "APROVADO" || estouro.situacao === "RECUSADO") && (
                <Resultado
                  icone={
                    estouro.situacao === "APROVADO" ? (
                      <CheckCircle2 className="w-5 h-5 text-success" aria-hidden />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" aria-hidden />
                    )
                  }
                  texto={`${estouro.situacao === "APROVADO" ? "Aprovado" : "Recusado"} por ${estouro.decididoPorNome ?? "—"}`}
                  quando={estouro.decididoEm}
                  obs={estouro.observacaoGestor}
                />
              )}
              {estouro.situacao === "CANCELADO" && (
                <Resultado
                  icone={<XCircle className="w-5 h-5 text-muted-foreground" aria-hidden />}
                  texto="Pedido cancelado"
                  quando={null}
                  obs={null}
                />
              )}
              {estouro.situacao === "EXPIRADO" && (
                <Resultado
                  icone={<Clock className="w-5 h-5 text-warning" aria-hidden />}
                  texto="Link expirado — peça um novo a quem fez o pedido"
                  quando={null}
                  obs={null}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <Rodape className="mt-8" />
    </main>
  )
}

function Aviso({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6 flex gap-3">
        {icone}
        <div>
          <p className="font-semibold text-foreground">{titulo}</p>
          <p className="text-sm text-muted-foreground mt-1">{texto}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Resultado({ icone, texto, quando, obs }: { icone: React.ReactNode; texto: string; quando: Date | null; obs: string | null }) {
  return (
    <div className="rounded-md border bg-muted p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        {icone}
        {texto}
      </p>
      {quando && <p className="mt-1 text-muted-foreground">em {formatarDataHoraPtBr(quando)}</p>}
      {obs && <p className="mt-1 text-foreground/80">“{obs}”</p>}
    </div>
  )
}
