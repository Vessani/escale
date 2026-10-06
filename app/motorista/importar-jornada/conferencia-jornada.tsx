"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { JornadaRelatorioParser, SEM_EDICOES, registrosParaImportar, type EdicoesJornada, type LinhaJornadaBruta, type LinhaRevisaoJornada, type RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import type { AjusteJornada } from "@/lib/validation/ajuste-jornada"
import type { CoberturaImportacaoJornada } from "@/lib/services/jornada-relatorio.service"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"
import { formatarDataHoraPtBr, formatarHoraLocal, formatDateTimeForInput, parseDateTimeFromInput } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { ESTILO_CATEGORIA, categoriaDaLinha, precisaAtencao } from "./categoria-linha"
import { LEGENDA, ROTULO_LEGENDA, ROTULO_SITUACAO, rotuloDia, type Rascunho } from "./conferencia-formato"
import { LinhaConferencia } from "./linha-conferencia"

/**
 * Conferência do Relatório de Jornada antes de importar: as linhas do
 * arquivo por dia (do primeiro ao último), cada uma colorida pelo que pode
 * estar errado, com editar e excluir ali mesmo. O motivo da cor fica no
 * tooltip. Toda edição reprocessa o motorista inteiro: os dias seguintes e
 * o 7º dia se ajustam na hora.
 */
export function ConferenciaJornada({
  brutas,
  matriculasCadastradas,
  importando,
  onConfirmar,
}: {
  brutas: LinhaJornadaBruta[]
  /** Matrículas dos motoristas cadastrados na filial — por padrão só eles aparecem (os outros nem são importados). */
  matriculasCadastradas: number[]
  importando: boolean
  onConfirmar: (registros: RegistroJornadaRelatorio[], ajustes: AjusteJornada[], cobertura: CoberturaImportacaoJornada) => void
}) {
  const [edicoes, setEdicoes] = useState<EdicoesJornada>(SEM_EDICOES)
  const [soCorrigir, setSoCorrigir] = useState(false)
  const [busca, setBusca] = useState("")
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [soCadastrados, setSoCadastrados] = useState(true)

  const cadastradas = useMemo(() => new Set(matriculasCadastradas), [matriculasCadastradas])
  /** Motoristas do arquivo sem cadastro no Escalador (a importação não teria onde gravar). */
  const naoCadastrados = useMemo(() => {
    const porMatricula = new Map<number, string>()
    for (const bruta of brutas) if (!cadastradas.has(bruta.matricula)) porMatricula.set(bruta.matricula, bruta.nome)
    return [...porMatricula].map(([matricula, nome]) => ({ matricula, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [brutas, cadastradas])
  const consideradas = useMemo(
    () => (soCadastrados ? brutas.filter((bruta) => cadastradas.has(bruta.matricula)) : brutas),
    [brutas, cadastradas, soCadastrados],
  )

  const brutaPorId = useMemo(() => new Map(brutas.map((bruta) => [bruta.id, bruta])), [brutas])
  const semEdicao = useMemo(() => new Map(JornadaRelatorioParser.processar(consideradas).map((linha) => [linha.id, linha])), [consideradas])
  const linhas = useMemo(() => JornadaRelatorioParser.processar(consideradas, edicoes), [consideradas, edicoes])
  const registros = useMemo(() => registrosParaImportar(linhas), [linhas])
  /** Período do arquivo inteiro e matrículas mostradas — re-importar apaga, nesse período, dias antigos que saíram do lote. */
  const cobertura = useMemo((): CoberturaImportacaoJornada => {
    const inicios = brutas.map((bruta) => bruta.inicio).sort()
    return {
      de: inicios[0] ?? new Date().toISOString(),
      ate: inicios[inicios.length - 1] ?? new Date().toISOString(),
      matriculas: [...new Set(consideradas.map((bruta) => bruta.matricula))],
    }
  }, [brutas, consideradas])
  const ordenadas = useMemo(
    () =>
      linhas
        .map((linha) => ({ linha, categoria: categoriaDaLinha(linha) }))
        .sort(
          (a, b) =>
            a.linha.nome.localeCompare(b.linha.nome, "pt-BR") ||
            a.linha.matricula - b.linha.matricula ||
            a.linha.dia.localeCompare(b.linha.dia) ||
            a.linha.inicioJornada.localeCompare(b.linha.inicioJornada),
        ),
    [linhas],
  )

  const paraCorrigir = ordenadas.filter((item) => precisaAtencao(item.categoria)).length
  const setimosDias = registros.filter((registro) => folgaEstourada(registro.diasSemFolga)).length
  const motoristas = new Set(registros.map((registro) => registro.matricula)).size

  /** Quantas linhas de cada motorista estão em destaque (e se alguma é 7º dia) — vai na faixa do motorista. */
  const destaquePorMotorista = useMemo(() => {
    const mapa = new Map<number, { total: number; setimoDia: boolean }>()
    for (const { linha, categoria } of ordenadas) {
      if (!precisaAtencao(categoria)) continue
      const atual = mapa.get(linha.matricula) ?? { total: 0, setimoDia: false }
      mapa.set(linha.matricula, { total: atual.total + 1, setimoDia: atual.setimoDia || categoria === "SETIMO_DIA" })
    }
    return mapa
  }, [ordenadas])

  const termo = busca.trim().toLowerCase()
  const visiveis = ordenadas.filter(({ linha, categoria }) => {
    if (termo && !linha.nome.toLowerCase().includes(termo) && !String(linha.matricula).includes(termo)) return false
    return !soCorrigir || precisaAtencao(categoria)
  })

  const editar = (linha: LinhaRevisaoJornada) =>
    setRascunho({
      id: linha.id,
      inicio: formatDateTimeForInput(linha.inicioJornada),
      fim: formatDateTimeForInput(linha.fimJornada),
      dias: String(linha.diasSemFolga),
      erro: "",
    })

  const salvar = (linha: LinhaRevisaoJornada) => {
    if (!rascunho) return
    let inicio: string
    let fim: string
    try {
      inicio = parseDateTimeFromInput(rascunho.inicio).toISOString()
      fim = parseDateTimeFromInput(rascunho.fim).toISOString()
    } catch {
      setRascunho({ ...rascunho, erro: "Data/hora inválida." })
      return
    }
    const dias = Number(rascunho.dias)
    if (new Date(fim) <= new Date(inicio)) return setRascunho({ ...rascunho, erro: "O fim tem que ser depois do início." })
    if (!Number.isInteger(dias) || dias < 1 || dias > 31) return setRascunho({ ...rascunho, erro: "Dias sem folga: de 1 a 31." })

    setEdicoes((atual) => {
      const horarios = { ...atual.horarios }
      const primeira = brutaPorId.get(linha.ids[0])
      const ultima = brutaPorId.get(linha.ids[linha.ids.length - 1])
      if (!primeira || !ultima) return atual
      // O campo de edição não tem segundos: comparar no minuto, senão salvar sem mexer no horário viraria "alterada".
      const mesmoMinuto = (a: string, b: string) => formatDateTimeForInput(a) === formatDateTimeForInput(b)
      const definir = (bruta: LinhaJornadaBruta, novo: { inicio: string; fim: string }) => {
        if (mesmoMinuto(novo.inicio, bruta.inicio) && mesmoMinuto(novo.fim, bruta.fim)) delete horarios[bruta.id]
        else horarios[bruta.id] = novo
      }
      if (primeira.id === ultima.id) {
        definir(primeira, { inicio, fim })
      } else {
        definir(primeira, { inicio, fim: atual.horarios[primeira.id]?.fim ?? primeira.fim })
        definir(ultima, { inicio: atual.horarios[ultima.id]?.inicio ?? ultima.inicio, fim })
      }
      const ajustes = { ...atual.dias }
      if (dias !== linha.diasSemFolga) ajustes[linha.id] = dias
      return { ...atual, horarios, dias: ajustes }
    })
    setRascunho(null)
  }

  const ajustesParaAuditoria = (): AjusteJornada[] =>
    linhas
      .filter((linha) => linha.editada || linha.situacao === "IGNORADA")
      .map((linha) => {
        const resumo = (item: LinhaRevisaoJornada | undefined): Record<string, string | number> =>
          item
            ? {
                Início: formatarDataHoraPtBr(item.inicioJornada),
                Fim: formatarDataHoraPtBr(item.fimJornada),
                "Dias sem folga": item.diasSemFolga,
                Situação: ROTULO_SITUACAO[item.situacao],
              }
            : {}
        return {
          matricula: linha.matricula,
          dia: linha.dia,
          contexto: `Importação do relatório · ${linha.nome} (${linha.matricula}) · jornada de ${rotuloDia(linha.dia).split(" · ")[0]} ${formatarHoraLocal(linha.original.inicio)}`,
          antes: resumo(semEdicao.get(linha.id)),
          depois: resumo(linha),
        }
      })

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {motoristas} motoristas · {registros.length} jornadas
          </h2>
          <p className="text-sm text-muted-foreground">
            {paraCorrigir > 0 ? `${paraCorrigir} linha(s) em destaque pra conferir.` : "Nada em destaque."} Confira e confirme.
          </p>
        </div>
        <Button
          type="button"
          disabled={importando || rascunho !== null}
          title={rascunho ? "Salve ou cancele a linha em edição antes de confirmar." : undefined}
          onClick={() => onConfirmar(registros, ajustesParaAuditoria(), cobertura)}
        >
          {importando ? "Importando..." : "Confirmar importação"}
        </Button>
      </div>

      <div className="space-y-3 px-5 py-4">
        {setimosDias > 0 && (
          <Alert variant="error">
            {setimosDias === 1 ? "1 jornada passou" : `${setimosDias} jornadas passaram`} de {MAX_DIAS_SEM_FOLGA} dias seguidos sem
            folga (em vermelho).
          </Alert>
        )}

        {naoCadastrados.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span title={naoCadastrados.map((motorista) => `${motorista.nome} (${motorista.matricula})`).join(", ")}>
              {soCadastrados ? "Escondidos" : "Mostrando também"} {naoCadastrados.length} motorista(s) do arquivo sem cadastro no Escalador
              {soCadastrados ? "" : " — eles não entram na importação"}.
            </span>
            <button
              type="button"
              onClick={() => setSoCadastrados((atual) => !atual)}
              className="w-fit font-medium text-primary underline-offset-4 hover:underline"
            >
              {soCadastrados ? "Mostrar" : "Esconder"}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit rounded-lg border bg-muted/40 p-1" role="group" aria-label="Quais linhas mostrar">
            {[
              { valor: false, rotulo: `Todas (${ordenadas.length})` },
              { valor: true, rotulo: `Só em destaque (${paraCorrigir})` },
            ].map((opcao) => (
              <button
                key={String(opcao.valor)}
                type="button"
                aria-pressed={soCorrigir === opcao.valor}
                onClick={() => setSoCorrigir(opcao.valor)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  soCorrigir === opcao.valor
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
          <label className="relative block md:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Motorista ou matrícula"
              className="h-8 pl-8 text-sm"
              aria-label="Buscar motorista"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table containerClassName="max-h-[65vh] overflow-auto" className="min-w-[700px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-32">Dia</TableHead>
                <TableHead className="w-48">Início</TableHead>
                <TableHead className="w-48">Fim</TableHead>
                <TableHead className="w-32">Dias sem folga</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {soCorrigir ? "Nada em destaque — pode confirmar." : "Nenhuma linha encontrada."}
                  </TableCell>
                </TableRow>
              )}
              {visiveis.map(({ linha, categoria }, indice) => {
                const anterior = visiveis[indice - 1]
                return (
                  <LinhaConferencia
                    key={`${linha.situacao}-${linha.id}`}
                    linha={linha}
                    categoria={categoria}
                    novoMotorista={indice === 0 || anterior.linha.matricula !== linha.matricula}
                    destaque={destaquePorMotorista.get(linha.matricula)}
                    cadastrado={cadastradas.has(linha.matricula)}
                    rascunho={rascunho}
                    edicoes={edicoes}
                    onRascunho={setRascunho}
                    onEditar={() => editar(linha)}
                    onSalvar={() => salvar(linha)}
                    onEdicoes={setEdicoes}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda das cores">
          {LEGENDA.map((categoria) => (
            <li key={categoria} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2.5 rounded-sm", ESTILO_CATEGORIA[categoria].ponto)} />
              {ROTULO_LEGENDA[categoria]}
            </li>
          ))}
          <li>· Passe o mouse na linha pra ver o motivo.</li>
        </ul>
      </div>
    </div>
  )
}
