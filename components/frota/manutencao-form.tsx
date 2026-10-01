"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { criarManutencao, editarManutencao } from "@/lib/actions/manutencoes"
import type { ManutencaoFormValues } from "@/lib/validation/manutencoes"
import { cn } from "@/lib/utils"

type Opcao<T extends string> = { valor: T; rotulo: string }

/** Grupo de botões de escolha única — mais rápido que um select pra 2 a 4 opções. */
function Escolha<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  disabled,
}: {
  rotulo: string
  opcoes: Opcao<T>[]
  valor: T | null
  onChange: (valor: T) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{rotulo}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {opcoes.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={valor === opcao.valor}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              valor === opcao.valor
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type Props = {
  /** Ausente = nova manutenção. */
  manutencaoId?: number
  valoresIniciais: ManutencaoFormValues
  /** Conjuntos cadastrados — sugestões de código e "puxa a carreta X". */
  conjuntos: Array<{ cavalo: string; carreta: string }>
}

export default function ManutencaoForm({ manutencaoId, valoresIniciais, conjuntos }: Props) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [dados, setDados] = useState<ManutencaoFormValues>(valoresIniciais)
  const atualizar = <K extends keyof ManutencaoFormValues>(campo: K, valor: ManutencaoFormValues[K]) =>
    setDados((atual) => ({ ...atual, [campo]: valor }))

  const codigos = useMemo(
    () => [...new Set(conjuntos.map((c) => (dados.veiculo === "CAVALO" ? c.cavalo : c.carreta)))].sort(),
    [conjuntos, dados.veiculo],
  )
  const conjunto = conjuntos.find((c) =>
    dados.veiculo === "CAVALO" ? c.cavalo === dados.codigo.trim() : c.carreta === dados.codigo.trim(),
  )

  const salvar = (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")
    iniciarTransicao(async () => {
      const resposta = manutencaoId ? await editarManutencao(manutencaoId, dados) : await criarManutencao(dados)
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      router.push("/frotas/manutencoes")
      router.refresh()
    })
  }

  return (
    <form onSubmit={salvar}>
      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="size-5" aria-hidden /> {manutencaoId ? "Editar manutenção" : "Agendar manutenção"}
          </CardTitle>
          <CardDescription>
            A manutenção é do cavalo <strong>ou</strong> da carreta — o conjunto fica indisponível se qualquer um dos dois
            estiver parado. Viagens que caírem no período ganham aviso.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Escolha
                rotulo="Veículo"
                valor={dados.veiculo}
                disabled={pendente}
                opcoes={[
                  { valor: "CARRETA", rotulo: "Carreta" },
                  { valor: "CAVALO", rotulo: "Cavalo" },
                ]}
                onChange={(veiculo) => {
                  // Trocando o veículo, sugere o outro lado do mesmo conjunto.
                  const outro = conjunto && (veiculo === "CAVALO" ? conjunto.cavalo : conjunto.carreta)
                  setDados((atual) => ({ ...atual, veiculo, codigo: outro ?? atual.codigo }))
                }}
              />
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Código {dados.veiculo === "CAVALO" ? "do cavalo" : "da carreta"}
                <Input
                  list="codigos-veiculo"
                  value={dados.codigo}
                  maxLength={7}
                  disabled={pendente}
                  placeholder={dados.veiculo === "CAVALO" ? "Ex: 2064" : "Ex: 908"}
                  onChange={(e) => atualizar("codigo", e.target.value)}
                  className="font-mono"
                  required
                />
                <datalist id="codigos-veiculo">
                  {codigos.map((codigo) => (
                    <option key={codigo} value={codigo} />
                  ))}
                </datalist>
                <span className="text-xs font-normal text-muted-foreground">
                  {conjunto
                    ? `Conjunto ${conjunto.cavalo} / ${conjunto.carreta}`
                    : "Pode ser um veículo sem conjunto cadastrado."}
                </span>
              </label>
            </div>

            <div className="space-y-4">
              <Escolha
                rotulo="Tipo"
                valor={dados.tipo}
                disabled={pendente}
                opcoes={[
                  { valor: "PREVENTIVA", rotulo: "Preventiva" },
                  { valor: "CORRETIVA", rotulo: "Corretiva" },
                ]}
                onChange={(tipo) => setDados((atual) => ({ ...atual, tipo, nivel: tipo === "PREVENTIVA" ? atual.nivel : null }))}
              />
              {dados.tipo === "PREVENTIVA" && (
                <Escolha
                  rotulo="Plano da preventiva"
                  valor={dados.nivel}
                  disabled={pendente}
                  opcoes={(["A", "B", "C", "D"] as const).map((nivel) => ({ valor: nivel, rotulo: nivel }))}
                  onChange={(nivel) => atualizar("nivel", nivel)}
                />
              )}
              <Escolha
                rotulo="Responsável"
                valor={dados.responsavel}
                disabled={pendente}
                opcoes={[
                  { valor: "WHITE_MARTINS", rotulo: "White Martins" },
                  { valor: "RITMO", rotulo: "Ritmo" },
                ]}
                onChange={(responsavel) => atualizar("responsavel", responsavel)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Início previsto
              <Input
                type="datetime-local"
                value={dados.inicioPrevisto}
                disabled={pendente}
                onChange={(e) => atualizar("inicioPrevisto", e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Fim previsto
              <Input
                type="datetime-local"
                value={dados.fimPrevisto ?? ""}
                disabled={pendente}
                onChange={(e) => atualizar("fimPrevisto", e.target.value)}
              />
              <span className="text-xs font-normal text-muted-foreground">Em branco = sem previsão (fica parado até concluir).</span>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Descrição
            <Textarea
              value={dados.descricao ?? ""}
              maxLength={500}
              rows={3}
              disabled={pendente}
              placeholder="Ex: troca de óleo e filtros, revisão dos freios, oficina X"
              onChange={(e) => atualizar("descricao", e.target.value)}
            />
          </label>

          {erro && <Alert variant="error">{erro}</Alert>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild type="button" variant="outline" disabled={pendente}>
              <Link href="/frotas/manutencoes">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando..." : manutencaoId ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
