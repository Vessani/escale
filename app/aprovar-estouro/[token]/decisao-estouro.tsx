"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { decidirEstouro } from "@/lib/actions/estouro-jornada-publico"
import { chamarAcao } from "@/lib/chamar-acao"
import { TAMANHO_MAXIMO_NOME_DECISOR, TAMANHO_MAXIMO_OBSERVACAO_GESTOR } from "@/lib/services/estouro-jornada-regras"

type Decisao = "APROVADO" | "RECUSADO"

// Nome de quem decide, lembrado neste celular — o gestor não precisa digitar toda vez.
const CHAVE_NOME = "escalador:estouro-nome-decisor"

// Lido com useSyncExternalStore (mesmo padrão da sidebar em layout-wrapper.tsx):
// no servidor é sempre vazio, no navegador o valor salvo — sem mismatch de
// hidratação e sem setState dentro de effect.
function lerNomeSalvo(): string {
  try {
    return window.localStorage.getItem(CHAVE_NOME) ?? ""
  } catch {
    return "" // localStorage indisponível (aba anônima, bloqueado): só não preenche.
  }
}
const nadaNoServidor = () => ""
const semInscricao = () => () => {}

/**
 * Botões de quem decide. Dois toques de propósito (escolher → confirmar): um
 * toque acidental no celular não aprova nada. O link circula no grupo, então
 * o nome é obrigatório — fica no registro junto com o IP.
 */
export function DecisaoEstouro({ token, expiraEm }: { token: string; expiraEm: string }) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [escolha, setEscolha] = useState<Decisao | null>(null)
  const nomeSalvo = useSyncExternalStore(semInscricao, lerNomeSalvo, nadaNoServidor)
  // null = ainda não mexeu no campo: mostra o nome salvo neste celular.
  const [nomeDigitado, setNome] = useState<string | null>(null)
  const nome = nomeDigitado ?? nomeSalvo
  const [observacao, setObservacao] = useState("")
  const [erro, setErro] = useState("")

  const confirmar = () => {
    if (!escolha) return
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => decidirEstouro({ token, decisao: escolha, nome, observacao }))
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      try {
        window.localStorage.setItem(CHAVE_NOME, nome.trim())
      } catch {
        // localStorage indisponível: só não lembra pra próxima.
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Este pedido aguarda a resposta do gestor. Link válido até {expiraEm}.</p>
      {erro && <Alert variant="error">{erro}</Alert>}

      {escolha === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" className="h-12 text-base" onClick={() => setEscolha("APROVADO")}>
            Aprovar
          </Button>
          <Button type="button" variant="destructive" className="h-12 text-base" onClick={() => setEscolha("RECUSADO")}>
            Recusar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Seu nome
            <Input
              autoComplete="name"
              maxLength={TAMANHO_MAXIMO_NOME_DECISOR}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Quem está decidindo"
              className="h-11 text-base text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Observação {escolha === "RECUSADO" ? "(recomendado: diga o porquê)" : "(opcional)"}
            <Textarea
              rows={3}
              maxLength={TAMANHO_MAXIMO_OBSERVACAO_GESTOR}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={escolha === "RECUSADO" ? "Ex: trocar o motorista no posto de Curitiba" : "Ex: ok, avisar o cliente"}
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="h-12" disabled={pendente} onClick={() => setEscolha(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 text-base"
              variant={escolha === "RECUSADO" ? "destructive" : "default"}
              disabled={pendente || nome.trim().length < 2}
              onClick={confirmar}
            >
              {pendente ? "Registrando..." : escolha === "APROVADO" ? "Confirmar aprovação" : "Confirmar recusa"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
