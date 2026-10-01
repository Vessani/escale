"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { EditarViagemInput } from "@/lib/types/types"
import type { ViagemAlocacao } from "@/lib/types/alocacao"
import { editarViagem } from "@/lib/actions/viagens"
import { useConflitosAlocacao } from "@/lib/hooks/use-conflitos-alocacao"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { formatarProduto } from "@/lib/services/produto.service"
import { CheckCircle2, PencilLine, Route, Save } from "lucide-react"
import { CartaoViagemAlocacao } from "@/components/viagem/cartao-viagem-alocacao"
import { EscolhaMotorista, SEM_MOTORISTA } from "@/components/viagem/escolha-motorista"

type Props = {
  viagens: ViagemAlocacao[]
}

export default function AlocacaoViagensClient({ viagens }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selecoes, setSelecoes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      viagens.map((viagem) => [viagem.id, viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""])
    )
  )
  const [salvandoId, setSalvandoId] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState<string>("")
  const [erro, setErro] = useState<string>("")

  const totalPendentes = useMemo(() => viagens.length, [viagens.length])

  const itensParaConflito = useMemo(
    () =>
      viagens.map((viagem) => ({
        chave: String(viagem.id),
        numViagem: viagem.numViagem,
        motoristaSugeridoId: viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : "",
        inicioPrevisto: viagem.inicioPrevisto,
        fimPrevisto: viagem.fimPrevisto,
      })),
    [viagens],
  )
  const selecoesPorChave = useMemo(
    () => Object.fromEntries(Object.entries(selecoes).map(([id, motoristaId]) => [String(id), motoristaId])),
    [selecoes],
  )
  const { conflitosPorViagem } = useConflitosAlocacao(itensParaConflito, selecoesPorChave)

  const atualizarSelecao = (viagemId: number, motoristaId: string) => {
    setSelecoes((atual) => ({
      ...atual,
      [viagemId]: motoristaId,
    }))
  }

  const salvarAlocacao = (viagem: ViagemAlocacao) => {
    const motoristaSelecionado = selecoes[viagem.id]

    if (!motoristaSelecionado || motoristaSelecionado === SEM_MOTORISTA) {
      setErro("Selecione um motorista antes de salvar a alocação.")
      return
    }

    // Produto passou a ser obrigatório pra salvar qualquer viagem — essa tela
    // não tem seletor de produto (só realoca motorista), então uma viagem
    // antiga sem produto definido precisa passar pela edição manual primeiro.
    if (!viagem.produto) {
      setErro('Essa viagem ainda não tem produto definido. Use "Manual" para editá-la e escolher o produto antes de alocar.')
      return
    }

    setErro("")
    setMensagem("")
    setSalvandoId(viagem.id)

    const payload: EditarViagemInput = {
      numViagem: viagem.numViagem,
      carreta: viagem.carreta,
      cavalo: viagem.cavalo,
      tanque: viagem.tanque,
      diasViagem: viagem.diasViagem,
      inicioPrevisto: viagem.inicioPrevisto,
      fimPrevisto: viagem.fimPrevisto,
      turno: viagem.turno,
      produto: viagem.produto,
      motoristaId: Number(motoristaSelecionado),
      entregas: viagem.entregas.map((entrega) => ({
        id: entrega.id,
        dataEntrega: entrega.dataEntrega,
        cliente: entrega.cliente,
        cidade: entrega.cidade,
        uf: entrega.uf,
        kg: entrega.kg,
        m3: entrega.m3,
        obs: entrega.obs,
        sapcode: entrega.sapcode,
        codewhite: entrega.codewhite,
      })),
    }

    startTransition(async () => {
      try {
        const resposta = await editarViagem(viagem.id, payload)

        if (!resposta.sucesso) {
          setErro(resposta.erro ?? "Não foi possível salvar a alocação.")
          return
        }

        setMensagem(`Viagem ${viagem.numViagem} alocada com sucesso.`)
        router.refresh()
      } catch {
        setErro("Ocorreu um erro inesperado ao salvar a alocação.")
      } finally {
        setSalvandoId(null)
      }
    })
  }

  if (totalPendentes === 0) {
    return (
      <EmptyState
        icone={CheckCircle2}
        classeIcone="text-success"
        titulo="Nenhuma viagem pendente"
        descricao="Todas as viagens disponíveis já possuem motorista alocado."
        acao={
          <Link href="/viagens">
            <Button variant="outline">Ver viagens</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-4">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-foreground/80" />
          <span className="font-medium text-foreground">{totalPendentes} viagem(ns) pendente(s)</span>
        </div>
        <Badge variant="outline">{isPending ? "Salvando..." : "Pronto para alocar"}</Badge>
      </div>

      {mensagem && <Alert variant="success">{mensagem}</Alert>}

      {erro && <Alert variant="error">{erro}</Alert>}

      <div className="grid gap-4">
        {viagens.map((viagem) => {
          const motoristaSelecionado = selecoes[viagem.id] || SEM_MOTORISTA
          const semCompatibilidade = viagem.motoristasCompativeis.length === 0
          const avisos = [
            ...(viagem.avisoFrotaIndisponivel ? [{ rotulo: "Frota indisponível no horário", detalhe: viagem.avisoFrotaIndisponivel }] : []),
            ...(viagem.avisoFrotaProdutoIncompativel ? [{ rotulo: "Frota de outro produto", detalhe: viagem.avisoFrotaProdutoIncompativel }] : []),
          ]

          return (
            <CartaoViagemAlocacao
              key={viagem.id}
              numViagem={viagem.numViagem}
              cavalo={viagem.cavalo}
              carreta={viagem.carreta}
              inicioPrevisto={viagem.inicioPrevisto}
              fimPrevisto={viagem.fimPrevisto}
              turno={viagem.turno}
              entregas={viagem.entregas}
              avisos={avisos}
              etiquetas={
                <>
                  {viagem.produto ? (
                    <Badge variant="outline">{formatarProduto(viagem.produto)}</Badge>
                  ) : (
                    <Badge variant="warning">Produto não definido</Badge>
                  )}
                  {viagem.integracaoExigida && <Badge variant="warning">Integração: {viagem.integracaoExigida}</Badge>}
                </>
              }
              lateral={
                <>
                  <Button
                    type="button"
                    disabled={semCompatibilidade || motoristaSelecionado === SEM_MOTORISTA || salvandoId === viagem.id}
                    onClick={() => salvarAlocacao(viagem)}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {salvandoId === viagem.id ? "Salvando..." : "Alocar"}
                  </Button>
                  <Button asChild type="button" variant="outline">
                    <Link href={`/viagens/editar/${viagem.id}`}>
                      <PencilLine className="mr-2 h-4 w-4" />
                      Editar viagem
                    </Link>
                  </Button>
                </>
              }
            >
              <p className="mb-2 text-sm font-medium text-foreground">
                Motorista <span className="font-normal text-muted-foreground">· {viagem.motoristasCompativeis.length} compatíve{viagem.motoristasCompativeis.length === 1 ? "l" : "is"}</span>
              </p>
              {semCompatibilidade ? (
                <Alert variant="warning">Nenhum motorista compatível (turno, dias, produto e integração). Use &quot;Editar viagem&quot; pra escolher manualmente.</Alert>
              ) : (
                <EscolhaMotorista
                  compativeis={viagem.motoristasCompativeis}
                  sugeridoId={viagem.motoristaSugerido?.id ?? null}
                  valor={motoristaSelecionado}
                  onChange={(valor) => atualizarSelecao(viagem.id, valor)}
                  inicioViagem={viagem.inicioPrevisto}
                  disabled={salvandoId === viagem.id}
                  conflitoNoLote={conflitosPorViagem[String(viagem.id)]}
                />
              )}
            </CartaoViagemAlocacao>
          )
        })}
      </div>
    </div>
  )
}
