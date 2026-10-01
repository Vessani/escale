"use client"

import { useMemo, useState } from "react"
import { Check, EyeOff, Pencil, RotateCcw, Search, Unlink, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  JornadaRelatorioParser,
  SEM_EDICOES,
  registrosParaImportar,
  type EdicoesJornada,
  type LinhaJornadaBruta,
  type LinhaRevisaoJornada,
  type RegistroJornadaRelatorio,
} from "@/lib/parsers/jornada-relatorio-parser"
import type { AjusteJornada } from "@/lib/validation/ajuste-jornada"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"
import { formatarDataHoraPtBr, formatarHoraLocal, formatDateTimeForInput, parseDateTimeFromInput } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { ESTILO_CATEGORIA, categoriaDaLinha, precisaAtencao, type CategoriaLinha } from "./categoria-linha"

type Filtro = "ATENCAO" | "TODAS" | Exclude<CategoriaLinha, "OK">

const FILTROS: Filtro[] = ["ATENCAO", "TODAS", "SETIMO_DIA", "EDITADA", "CORRIGIDA", "SEM_PAR", "FORA"]

const ROTULO_SITUACAO: Record<LinhaRevisaoJornada["situacao"], string> = {
  IMPORTAR: "Importada",
  MESMO_DIA: "Fora do calendário (outra jornada mais tarde no dia)",
  IGNORADA: "Ignorada",
  ABSORVIDA: "Batida extra desconsiderada",
}

type Rascunho = { id: number; inicio: string; fim: string; dias: string; erro: string }

/** Tira do conjunto de edições tudo o que vale pras linhas do arquivo `ids` (e o ajuste de dias da linha `id`). */
function semEdicoesDe(edicoes: EdicoesJornada, id: number, ids: number[]): EdicoesJornada {
  const remover = new Set(ids)
  const horarios = { ...edicoes.horarios }
  for (const chave of ids) delete horarios[chave]
  const dias = { ...edicoes.dias }
  delete dias[id]
  return {
    ignoradas: edicoes.ignoradas.filter((chave) => !remover.has(chave)),
    semCorrecao: edicoes.semCorrecao.filter((chave) => !remover.has(chave)),
    horarios,
    dias,
  }
}

function Situacao({ linha }: { linha: LinhaRevisaoJornada }) {
  const partes: string[] = []
  if (linha.situacao !== "IMPORTAR") partes.push(ROTULO_SITUACAO[linha.situacao])
  if (linha.correcao === "BATIDAS_UNIDAS") partes.push("Batidas unidas (entrada e saída em linhas separadas)")
  if (linha.correcao === "BATIDA_EXTRA") partes.push(`Batida das ${linha.batidaExtra} desconsiderada`)
  if (linha.correcao === "BATIDA_SEM_PAR") partes.push("Batida sem par — o fim pode não ser o real")
  if (linha.situacao === "IMPORTAR" && folgaEstourada(linha.diasSemFolga)) partes.push(`Passou de ${MAX_DIAS_SEM_FOLGA} dias sem folga`)
  if (linha.editada && linha.situacao !== "IGNORADA") partes.push("Editada")
  return <span className="text-xs leading-snug">{partes.join(" · ") || "—"}</span>
}

/** "17/09 05:51" — o relatório é de um mês só, o ano não ajuda a conferir. */
function diaHora(valor: string) {
  return formatarDataHoraPtBr(valor).replace(/\/\d{4},?/, "")
}

function Horario({ valor, original, riscado }: { valor: string; original: string; riscado: boolean }) {
  return (
    <div className="whitespace-nowrap font-mono tabular-nums">
      <span className={cn(riscado && "line-through")}>{diaHora(valor)}</span>
      {diaHora(valor) !== diaHora(original) && <div className="text-[11px] text-muted-foreground">era {formatarHoraLocal(original)}</div>}
    </div>
  )
}

/**
 * Conferência do Relatório de Jornada antes de importar: cada linha do
 * arquivo aparece (nada é descartado sem aparecer), colorida pelo que
 * precisa de atenção, e dá pra corrigir na hora — horário, dias sem folga,
 * ignorar uma linha que não era jornada, desfazer uma correção automática.
 * Toda edição reprocessa o motorista inteiro: os dias seguintes e o 7º dia
 * se ajustam na hora.
 */
export function ConferenciaJornada({
  brutas,
  importando,
  onConfirmar,
}: {
  brutas: LinhaJornadaBruta[]
  importando: boolean
  onConfirmar: (registros: RegistroJornadaRelatorio[], ajustes: AjusteJornada[]) => void
}) {
  const [edicoes, setEdicoes] = useState<EdicoesJornada>(SEM_EDICOES)
  const [filtro, setFiltro] = useState<Filtro>("ATENCAO")
  const [busca, setBusca] = useState("")
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)

  const brutaPorId = useMemo(() => new Map(brutas.map((bruta) => [bruta.id, bruta])), [brutas])
  const semEdicao = useMemo(() => new Map(JornadaRelatorioParser.processar(brutas).map((linha) => [linha.id, linha])), [brutas])
  const linhas = useMemo(() => JornadaRelatorioParser.processar(brutas, edicoes), [brutas, edicoes])
  const comCategoria = useMemo(() => linhas.map((linha) => ({ linha, categoria: categoriaDaLinha(linha) })), [linhas])
  const registros = useMemo(() => registrosParaImportar(linhas), [linhas])

  const contagem = (alvo: Filtro) =>
    alvo === "TODAS"
      ? comCategoria.length
      : alvo === "ATENCAO"
        ? comCategoria.filter((item) => precisaAtencao(item.categoria)).length
        : comCategoria.filter((item) => item.categoria === alvo).length

  const termo = busca.trim().toLowerCase()
  const visiveis = comCategoria.filter(({ linha, categoria }) => {
    if (termo && !linha.nome.toLowerCase().includes(termo) && !String(linha.matricula).includes(termo)) return false
    if (filtro === "TODAS") return true
    if (filtro === "ATENCAO") return precisaAtencao(categoria)
    return categoria === filtro
  })

  const setimosDias = registros.filter((registro) => folgaEstourada(registro.diasSemFolga)).length

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
      // O campo de edição não tem segundos: comparar no minuto, senão salvar sem mexer no horário viraria "editada".
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
        const antes = semEdicao.get(linha.id)
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
          contexto: `Importação do relatório · ${linha.nome} (${linha.matricula}) · jornada de ${diaHora(linha.original.inicio)}`,
          antes: resumo(antes),
          depois: resumo(linha),
        }
      })

  const motoristas = new Set(registros.map((registro) => registro.matricula)).size

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {motoristas} motorista(s) — {registros.length} jornada(s) vão pro calendário
          </h2>
          <p className="text-sm text-muted-foreground">
            Confira e corrija antes de confirmar: a importação atualiza o cadastro dos motoristas, o calendário e os relatórios de
            jornada. {brutas.length} linha(s) no arquivo.
          </p>
        </div>
        <Button
          type="button"
          disabled={importando || rascunho !== null}
          title={rascunho ? "Salve ou cancele a linha em edição antes de confirmar." : undefined}
          onClick={() => onConfirmar(registros, ajustesParaAuditoria())}
        >
          {importando ? "Importando..." : "Confirmar importação"}
        </Button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {setimosDias > 0 && (
          <Alert variant="error">
            {setimosDias} jornada(s) passaram de {MAX_DIAS_SEM_FOLGA} dias seguidos sem folga (em vermelho). Se for erro de batida,
            corrija aqui — senão elas ficam registradas em Relatórios → Estouro de 7º dia.
          </Alert>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar linhas">
            {FILTROS.map((alvo) => {
              const total = contagem(alvo)
              if (total === 0 && alvo !== "ATENCAO" && alvo !== "TODAS") return null
              const rotulo = alvo === "ATENCAO" ? "Precisam de atenção" : alvo === "TODAS" ? "Todas" : ESTILO_CATEGORIA[alvo].rotulo
              return (
                <button
                  key={alvo}
                  type="button"
                  aria-pressed={filtro === alvo}
                  onClick={() => setFiltro(alvo)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                    filtro === alvo ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {alvo !== "ATENCAO" && alvo !== "TODAS" && (
                    <span aria-hidden className={cn("size-2 rounded-full", ESTILO_CATEGORIA[alvo].ponto)} />
                  )}
                  {rotulo}
                  <span className="tabular-nums opacity-70">{total}</span>
                </button>
              )
            })}
          </div>
          <label className="relative block lg:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Motorista ou matrícula" className="h-8 pl-8 text-sm" aria-label="Buscar motorista" />
          </label>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table containerClassName="max-h-[60vh] overflow-auto" className="min-w-[1000px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-20">Matrícula</TableHead>
                <TableHead className="w-44">Motorista</TableHead>
                <TableHead className="w-32">Início</TableHead>
                <TableHead className="w-32">Fim</TableHead>
                <TableHead className="w-36">Dias sem folga</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {filtro === "ATENCAO" ? "Nada pra conferir — todas as linhas estão ok." : "Nenhuma linha nesse filtro."}
                  </TableCell>
                </TableRow>
              )}
              {visiveis.map(({ linha, categoria }) => {
                const emEdicao = rascunho?.id === linha.id
                const ignorada = linha.situacao === "IGNORADA"
                const podeEditar = linha.situacao === "IMPORTAR" || linha.situacao === "MESMO_DIA"
                const temEdicao =
                  linha.editada || ignorada || linha.ids.some((id) => edicoes.semCorrecao.includes(id)) || edicoes.dias[linha.id] !== undefined
                return (
                  <TableRow key={`${linha.situacao}-${linha.id}`} className={cn(ESTILO_CATEGORIA[categoria].linha, "align-top")}>
                    <TableCell className="font-mono tabular-nums">{linha.matricula}</TableCell>
                    <TableCell className={cn(ignorada && "line-through")}>{linha.nome}</TableCell>
                    {emEdicao && rascunho ? (
                      <>
                        <TableCell>
                          <Input
                            type="datetime-local"
                            value={rascunho.inicio}
                            onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value, erro: "" })}
                            className="h-8 px-2 text-xs"
                            aria-label="Início da jornada"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="datetime-local"
                            value={rascunho.fim}
                            onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value, erro: "" })}
                            className="h-8 px-2 text-xs"
                            aria-label="Fim da jornada"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={rascunho.dias}
                            onChange={(e) => setRascunho({ ...rascunho, dias: e.target.value, erro: "" })}
                            className="h-8 w-20 px-2 text-xs"
                            aria-label="Dias sem folga"
                          />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="text-xs text-muted-foreground">
                            Os dias seguintes deste motorista se ajustam até a próxima folga.
                          </span>
                          {rascunho.erro && <p className="mt-1 text-xs font-medium text-destructive">{rascunho.erro}</p>}
                        </TableCell>
                        <TableCell>
                          <AcoesLinha>
                            <BotaoIcone rotulo="Salvar" icone={Check} onClick={() => salvar(linha)} />
                            <BotaoIcone rotulo="Cancelar" icone={X} onClick={() => setRascunho(null)} />
                          </AcoesLinha>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <Horario valor={linha.inicioJornada} original={linha.original.inicio} riscado={ignorada} />
                        </TableCell>
                        <TableCell>
                          <Horario valor={linha.fimJornada} original={linha.original.fim} riscado={ignorada} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {linha.situacao === "IMPORTAR" || linha.situacao === "MESMO_DIA" ? (
                            <>
                              {folgaEstourada(linha.diasSemFolga) ? `${linha.diasSemFolga}º dia sem folga` : linha.diasSemFolga}
                              {linha.diasSemFolga !== linha.diasSemFolgaRelatorio && (
                                <span className="ml-1 text-xs text-muted-foreground">(relatório: {linha.diasSemFolgaRelatorio})</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">relatório: {linha.diasSemFolgaRelatorio} · não conta</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Situacao linha={linha} />
                        </TableCell>
                        <TableCell>
                          <AcoesLinha>
                            {podeEditar && (
                              <BotaoIcone rotulo="Editar horário e dias" icone={Pencil} disabled={rascunho !== null} onClick={() => editar(linha)} />
                            )}
                            {linha.correcao === "BATIDAS_UNIDAS" && !temEdicao && (
                              <BotaoIcone
                                rotulo="Separar as batidas (não juntar)"
                                icone={Unlink}
                                disabled={rascunho !== null}
                                onClick={() => setEdicoes((atual) => ({ ...atual, semCorrecao: [...atual.semCorrecao, ...linha.ids] }))}
                              />
                            )}
                            {linha.situacao === "ABSORVIDA" && (
                              <BotaoIcone
                                rotulo="Considerar como jornada"
                                icone={Unlink}
                                disabled={rascunho !== null}
                                onClick={() => setEdicoes((atual) => ({ ...atual, semCorrecao: [...atual.semCorrecao, linha.id] }))}
                              />
                            )}
                            {podeEditar && (
                              <BotaoIcone
                                rotulo="Ignorar esta linha (não era jornada)"
                                icone={EyeOff}
                                perigo
                                disabled={rascunho !== null}
                                onClick={() => setEdicoes((atual) => ({ ...atual, ignoradas: [...atual.ignoradas, ...linha.ids] }))}
                              />
                            )}
                            {temEdicao && (
                              <BotaoIcone
                                rotulo="Desfazer minhas alterações nesta linha"
                                icone={RotateCcw}
                                disabled={rascunho !== null}
                                onClick={() => setEdicoes((atual) => semEdicoesDe(atual, linha.id, linha.ids))}
                              />
                            )}
                          </AcoesLinha>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Vermelho: 7º dia ou mais · Azul: você alterou · Laranja: o sistema corrigiu · Amarelo: batida sem par · Cinza: não entra no
          calendário. O que você alterar fica registrado no Histórico.
        </p>
      </div>
    </div>
  )
}
