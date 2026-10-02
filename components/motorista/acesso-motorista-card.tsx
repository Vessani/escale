"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Smartphone } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { desativarAcesso, gerarAcessoMotorista } from "@/lib/actions/acesso-motorista"
import type { SituacaoAcesso } from "@/lib/services/acesso-motorista.service"
import { chamarAcao } from "@/lib/chamar-acao"

const ROTULO: Record<SituacaoAcesso, { texto: string; classe: string }> = {
  SEM_ACESSO: { texto: "Sem acesso", classe: "text-muted-foreground" },
  ATIVO: { texto: "Ativo", classe: "border-success/30 bg-success/10 text-success" },
  DESATIVADO: { texto: "Desativado", classe: "border-destructive/30 bg-destructive/10 text-destructive" },
}

/**
 * Acesso do motorista à área "Minhas viagens" (celular): gera o PIN — que
 * aparece só agora, pra anotar e passar pra ele — e desativa.
 */
export function AcessoMotoristaCard({ motoristaId, seva, situacao }: { motoristaId: number; seva: number; situacao: SituacaoAcesso }) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [pin, setPin] = useState<string | null>(null)
  const [confirmarDesativar, setConfirmarDesativar] = useState(false)

  const gerar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => gerarAcessoMotorista(motoristaId))
      if (!resposta.sucesso) return setErro(resposta.erro)
      setPin(resposta.pin)
      router.refresh()
    })
  }

  const desativar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => desativarAcesso(motoristaId))
      if (!resposta.sucesso) return setErro(resposta.erro)
      setPin(null)
      setConfirmarDesativar(false)
      router.refresh()
    })
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Smartphone className="size-5" aria-hidden /> Acesso do motorista
          <Badge variant="outline" className={ROTULO[situacao].classe}>
            {ROTULO[situacao].texto}
          </Badge>
        </CardTitle>
        <CardDescription>
          Pelo celular ele vê as viagens dele, inicia (km e motivo do atraso), lança pedágio/pernoite e encerra. Entra com a
          matrícula e um PIN.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {pin && (
          <Alert variant="success">
            <div className="space-y-1">
              <p className="font-medium">Anote e passe pro motorista — o PIN não aparece de novo:</p>
              <p className="font-mono text-lg">
                Matrícula <strong>{seva}</strong> · PIN <strong className="tracking-widest">{pin}</strong>
              </p>
              <p className="text-xs">
                Ele entra em {typeof window !== "undefined" ? window.location.host : "o endereço do Escalador"}, escolhe
                &quot;Motorista&quot; e digita os dois.
              </p>
            </div>
          </Alert>
        )}
        {erro && <Alert variant="error">{erro}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={gerar} disabled={pendente}>
            <KeyRound className="size-4" aria-hidden />
            {pendente ? "Gerando..." : situacao === "SEM_ACESSO" ? "Criar acesso" : situacao === "DESATIVADO" ? "Reativar com PIN novo" : "Gerar PIN novo"}
          </Button>
          {situacao === "ATIVO" && (
            <Button type="button" variant="outline" onClick={() => setConfirmarDesativar(true)} disabled={pendente}>
              Desativar acesso
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmarDesativar}
        onOpenChange={setConfirmarDesativar}
        title="Desativar o acesso do motorista?"
        description="Ele sai do sistema na hora e não consegue entrar de novo até alguém gerar um PIN novo."
        confirmLabel="Desativar"
        confirmingLabel="Desativando..."
        confirming={pendente}
        erro={erro || null}
        onConfirm={desativar}
      />
    </Card>
  )
}
