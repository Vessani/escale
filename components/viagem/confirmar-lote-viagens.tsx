"use client"

import { useMemo, useState, useTransition } from "react"
import type { TipoProduto } from "@prisma/client"
import type { SugestaoAlocacaoPendente } from "@/lib/types/alocacao"
import type { NovaViagemFormValues } from "@/lib/validation/viagens"
import type { ResultadoImportacaoLote } from "@/lib/types/types"
import { criarViagensEmLoteComAlocacao, sugerirAlocacaoParaViagens } from "@/lib/actions/viagens"
import { periodoConflita } from "@/lib/services/alocacao.service"
import { useConflitosAlocacao } from "@/lib/hooks/use-conflitos-alocacao"
import { viagensCompartilhamFrota } from "@/lib/services/frota-regras"
import { PRODUTO_OPCOES, ehTipoProduto, formatarProduto } from "@/lib/services/produto.service"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CartaoViagemAlocacao } from "@/components/viagem/cartao-viagem-alocacao"
import { EscolhaMotorista, SEM_MOTORISTA } from "@/components/viagem/escolha-motorista"
import { CheckCircle2, Loader2, PackageCheck, UserCheck } from "lucide-react"
import { mensagemDaFalha } from "@/lib/chamar-acao"

export type ViagemParaConfirmar = {
  dados: NovaViagemFormValues
  sugestao: SugestaoAlocacaoPendente
}

type Props = {
  viagens: ViagemParaConfirmar[]
  onConcluido: (resultado: ResultadoImportacaoLote) => void
  onCancelar: () => void
}

/** Valor do seletor "produto de todas" quando cada viagem tem um diferente. */
const VARIOS = "VARIOS"

function selecaoInicial(sugestao: SugestaoAlocacaoPendente) {
  return sugestao.motoristaSugerido ? String(sugestao.motoristaSugerido.id) : SEM_MOTORISTA
}

/**
 * Revisão do lote importado da planilha, antes de criar. O produto vem do
 * cadastro da carreta quando existe e, no resto, é escolhido UMA vez pra
 * todas (com ajuste por viagem). Trocar o produto refaz a sugestão daquela
 * viagem — os motoristas compatíveis dependem dele.
 */
export default function ConfirmarLoteViagens({ viagens, onConcluido, onCancelar }: Props) {
  const [criando, iniciarCriacao] = useTransition()
  const [erro, setErro] = useState("")
  const [sugestoes, setSugestoes] = useState<Record<string, SugestaoAlocacaoPendente>>(() =>
    Object.fromEntries(viagens.map((viagem) => [viagem.dados.numViagem, viagem.sugestao])),
  )
  const [produtos, setProdutos] = useState<Record<string, TipoProduto | "">>(() =>
    Object.fromEntries(viagens.map((viagem) => [viagem.dados.numViagem, viagem.sugestao.produtoDaFrota ?? ""])),
  )
  const [selecoes, setSelecoes] = useState<Record<string, string>>(() =>
    Object.fromEntries(viagens.map((viagem) => [viagem.dados.numViagem, selecaoInicial(viagem.sugestao)])),
  )
  const [recalculando, setRecalculando] = useState<Set<string>>(new Set())

  /** Refaz a sugestão das viagens informadas com o produto escolhido (os compatíveis dependem dele). */
  const recalcular = async (produtosNovos: Record<string, TipoProduto | "">, numeros: string[]) => {
    const alvo = viagens.filter((viagem) => numeros.includes(viagem.dados.numViagem) && produtosNovos[viagem.dados.numViagem])
    if (alvo.length === 0) return
    setRecalculando((atual) => new Set([...atual, ...alvo.map((viagem) => viagem.dados.numViagem)]))
    try {
      const resultado = await sugerirAlocacaoParaViagens(
        alvo.map((viagem) => ({ ...viagem.dados, produto: produtosNovos[viagem.dados.numViagem] as TipoProduto })),
      )
      setSugestoes((atual) => ({ ...atual, ...Object.fromEntries(resultado.map((sugestao) => [sugestao.numViagem, sugestao])) }))
      setSelecoes((atual) => {
        const proximo = { ...atual }
        for (const sugestao of resultado) {
          const escolhido = atual[sugestao.numViagem]
          // Mantém quem a pessoa escolheu, se continua compatível com o produto.
          const continuaValido = sugestao.motoristasCompativeis.some((m) => String(m.id) === escolhido)
          proximo[sugestao.numViagem] = continuaValido && escolhido !== SEM_MOTORISTA ? escolhido : selecaoInicial(sugestao)
        }
        return proximo
      })
    } catch (erro) {
      setErro(mensagemDaFalha(erro))
    } finally {
      setRecalculando((atual) => {
        const proximo = new Set(atual)
        for (const viagem of alvo) proximo.delete(viagem.dados.numViagem)
        return proximo
      })
    }
  }

  const mudarProduto = (numeros: string[], produto: TipoProduto) => {
    const proximos = { ...produtos, ...Object.fromEntries(numeros.map((numero) => [numero, produto])) }
    setProdutos(proximos)
    void recalcular(proximos, numeros)
  }

  const valoresProduto = new Set(Object.values(produtos))
  const produtoDeTodas = valoresProduto.size === 1 ? [...valoresProduto][0] : VARIOS
  const semProduto = viagens.filter((viagem) => !ehTipoProduto(produtos[viagem.dados.numViagem] ?? "")).length
  const vindosDaFrota = viagens.filter((viagem) => viagem.sugestao.produtoDaFrota).length

  const itensParaConflito = useMemo(
    () =>
      viagens.map((viagem) => ({
        chave: viagem.dados.numViagem,
        numViagem: viagem.dados.numViagem,
        motoristaSugeridoId: "",
        inicioPrevisto: viagem.dados.inicioPrevisto,
        fimPrevisto: viagem.dados.fimPrevisto,
      })),
    [viagens],
  )
  const { conflitosPorViagem } = useConflitosAlocacao(itensParaConflito, selecoes)

  // Mesma carreta em duas viagens do próprio lote, em período sobreposto (o
  // aviso de frota do servidor só olha o banco, onde elas ainda não existem).
  const conflitosFrotaPorViagem = useMemo(() => {
    const mapa: Record<string, string[]> = {}
    for (const a of viagens) {
      const conflitantes = viagens
        .filter(
          (b) =>
            b.dados.numViagem !== a.dados.numViagem &&
            viagensCompartilhamFrota(a.dados.carreta, b.dados.carreta) &&
            periodoConflita(
              new Date(a.dados.inicioPrevisto),
              new Date(a.dados.fimPrevisto),
              new Date(b.dados.inicioPrevisto),
              new Date(b.dados.fimPrevisto),
            ),
        )
        .map((b) => b.dados.numViagem)
      if (conflitantes.length > 0) mapa[a.dados.numViagem] = conflitantes
    }
    return mapa
  }, [viagens])

  const confirmarCriacao = () => {
    setErro("")
    const pendente = viagens.find((viagem) => !ehTipoProduto(produtos[viagem.dados.numViagem] ?? ""))
    if (pendente) {
      setErro(`Escolha o produto da viagem ${pendente.dados.numViagem} antes de confirmar.`)
      return
    }

    const payload = viagens.map((viagem) => {
      const selecionado = selecoes[viagem.dados.numViagem]
      return {
        dados: { ...viagem.dados, produto: produtos[viagem.dados.numViagem] as TipoProduto },
        motoristaId: selecionado && selecionado !== SEM_MOTORISTA ? Number(selecionado) : null,
      }
    })

    iniciarCriacao(async () => {
      try {
        onConcluido(await criarViagensEmLoteComAlocacao(payload))
      } catch (erro) {
        setErro(mensagemDaFalha(erro))
      }
    })
  }

  const alocadas = viagens.filter((viagem) => (selecoes[viagem.dados.numViagem] ?? SEM_MOTORISTA) !== SEM_MOTORISTA).length

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 space-y-3 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Revise {viagens.length} viagem(ns) antes de criar</p>
              <p className="text-xs text-muted-foreground">
                {alocadas} com motorista · {viagens.length - alocadas} sem
                {recalculando.size > 0 && " · recalculando sugestões..."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={criando} onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="button" disabled={criando || recalculando.size > 0} onClick={confirmarCriacao}>
              {criando ? (
                "Criando viagens..."
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" aria-hidden />
                  Criar {viagens.length} viagem(ns)
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <PackageCheck className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">Produto das viagens</span>
          <Select
            value={produtoDeTodas === VARIOS || produtoDeTodas === "" ? "" : produtoDeTodas}
            onValueChange={(valor) =>
              mudarProduto(
                viagens.map((viagem) => viagem.dados.numViagem),
                valor as TipoProduto,
              )
            }
            disabled={criando}
          >
            <SelectTrigger className="h-8 w-48 bg-card text-xs">
              <SelectValue placeholder={produtoDeTodas === VARIOS ? "Vários — aplicar a todas" : "Escolha pra todas"} />
            </SelectTrigger>
            <SelectContent>
              {PRODUTO_OPCOES.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {vindosDaFrota > 0 && `${vindosDaFrota} preenchida(s) pelo cadastro da carreta. `}
            {semProduto > 0 ? (
              <span className="font-medium text-warning">{semProduto} sem produto.</span>
            ) : (
              "Dá pra ajustar viagem por viagem."
            )}
          </span>
        </div>
        {erro && <Alert variant="error">{erro}</Alert>}
      </div>

      <div className="grid gap-4">
        {viagens.map(({ dados }) => {
          const numViagem = dados.numViagem
          const sugestao = sugestoes[numViagem]
          const produto = produtos[numViagem] ?? ""
          const ocupado = recalculando.has(numViagem)
          const avisos = [
            ...(sugestao.avisoFrotaIndisponivel
              ? [{ rotulo: "Frota indisponível no horário", detalhe: sugestao.avisoFrotaIndisponivel }]
              : []),
            ...(sugestao.avisoFrotaProdutoIncompativel
              ? [{ rotulo: "Frota de outro produto", detalhe: sugestao.avisoFrotaProdutoIncompativel }]
              : []),
            ...(conflitosFrotaPorViagem[numViagem]
              ? [
                  {
                    rotulo: `Mesma carreta na(s) viagem(ns) ${conflitosFrotaPorViagem[numViagem].join(", ")}`,
                    detalhe: "No mesmo período, dentro desta planilha.",
                  },
                ]
              : []),
          ]

          return (
            <CartaoViagemAlocacao
              key={numViagem}
              numViagem={numViagem}
              cavalo={dados.cavalo}
              carreta={dados.carreta}
              inicioPrevisto={String(dados.inicioPrevisto)}
              fimPrevisto={String(dados.fimPrevisto)}
              turno={dados.turno}
              entregas={dados.entregas.map((entrega) => ({ ...entrega, dataEntrega: String(entrega.dataEntrega) }))}
              avisos={avisos}
              etiquetas={
                produto ? <Badge variant="outline">{formatarProduto(produto)}</Badge> : <Badge variant="warning">Sem produto</Badge>
              }
              lateral={
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Produto desta viagem
                  <Select value={produto} onValueChange={(valor) => mudarProduto([numViagem], valor as TipoProduto)} disabled={criando}>
                    <SelectTrigger className="h-8 bg-card text-xs">
                      <SelectValue placeholder="Escolha o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUTO_OPCOES.map((opcao) => (
                        <SelectItem key={opcao.valor} value={opcao.valor}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              }
            >
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                Motorista
                <span className="font-normal text-muted-foreground">
                  · {sugestao.motoristasCompativeis.length} compatíve{sugestao.motoristasCompativeis.length === 1 ? "l" : "is"}
                  {!produto && " (sem filtrar por produto)"}
                </span>
                {ocupado && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Recalculando" />}
              </p>
              {sugestao.motoristasCompativeis.length === 0 ? (
                <Alert variant="warning">Nenhum motorista compatível — a viagem é criada sem motorista; aloque depois.</Alert>
              ) : (
                <EscolhaMotorista
                  compativeis={sugestao.motoristasCompativeis}
                  sugeridoId={sugestao.motoristaSugerido?.id ?? null}
                  valor={selecoes[numViagem] ?? SEM_MOTORISTA}
                  onChange={(valor) => setSelecoes((atual) => ({ ...atual, [numViagem]: valor }))}
                  inicioViagem={String(dados.inicioPrevisto)}
                  disabled={criando || ocupado}
                  conflitoNoLote={conflitosPorViagem[numViagem]}
                />
              )}
            </CartaoViagemAlocacao>
          )
        })}
      </div>
    </div>
  )
}
