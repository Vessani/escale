"use client"

import type { Dispatch, SetStateAction } from "react"
import { Check, Pencil, RotateCcw, Trash2, Undo2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { TableCell, TableRow } from "@/components/ui/table"
import type { EdicoesJornada, LinhaRevisaoJornada } from "@/lib/parsers/jornada-relatorio-parser"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { ESTILO_CATEGORIA, type CategoriaLinha } from "./categoria-linha"
import { diaCurto, diasEntre, motivo, semEdicoesDe, type Rascunho } from "./conferencia-formato"

/**
 * Uma linha da conferência (com a faixa do motorista quando ele muda):
 * mostra a jornada ou os campos de edição, e as ações da linha.
 */
export function LinhaConferencia({
  linha,
  categoria,
  novoMotorista,
  destaque,
  cadastrado,
  rascunho,
  edicoes,
  onRascunho,
  onEditar,
  onSalvar,
  onEdicoes,
}: {
  linha: LinhaRevisaoJornada
  categoria: CategoriaLinha
  novoMotorista: boolean
  destaque: { total: number; setimoDia: boolean } | undefined
  cadastrado: boolean
  rascunho: Rascunho | null
  edicoes: EdicoesJornada
  onRascunho: (rascunho: Rascunho | null) => void
  onEditar: () => void
  onSalvar: () => void
  onEdicoes: Dispatch<SetStateAction<EdicoesJornada>>
}) {
const dia = diaCurto(linha.dia)
  const emEdicao = rascunho?.id === linha.id ? rascunho : null
const fora = linha.situacao !== "IMPORTAR"
const podeEditar = linha.situacao === "IMPORTAR" || linha.situacao === "MESMO_DIA"
const alteradaPorVoce =
  linha.situacao !== "IGNORADA" &&
  (linha.editada || linha.ids.some((id) => edicoes.semCorrecao.includes(id)) || edicoes.dias[linha.id] !== undefined)
const diasDepois = diasEntre(linha.inicioJornada, linha.fimJornada)
return (
  <>
    {novoMotorista && (
      <TableRow className="bg-muted/70 hover:bg-muted/70">
        <TableCell colSpan={5} className="py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-foreground">
              {linha.nome}
              <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{linha.matricula}</span>
              {!cadastrado && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">· sem cadastro, não importa</span>
              )}
            </span>
            {destaque && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  destaque.setimoDia ? "bg-destructive/15 text-destructive" : "bg-background text-muted-foreground ring-1 ring-border",
                )}
              >
                {destaque.total} em destaque
              </span>
            )}
          </div>
        </TableCell>
      </TableRow>
    )}
    <TableRow className={ESTILO_CATEGORIA[categoria].linha} title={motivo(linha) || undefined}>
      <TableCell className={cn("tabular-nums", linha.situacao === "IGNORADA" && "line-through")}>
        <span className="font-mono">{dia.data}</span>
        <span className="ml-1.5 text-xs text-muted-foreground">{dia.semana}</span>
      </TableCell>
      {emEdicao ? (
        <>
          <TableCell>
            <Input
              type="datetime-local"
              value={emEdicao.inicio}
              onChange={(e) => onRascunho({ ...emEdicao, inicio: e.target.value, erro: "" })}
              className="h-8 px-2 text-xs"
              aria-label="Início da jornada"
            />
          </TableCell>
          <TableCell>
            <Input
              type="datetime-local"
              value={emEdicao.fim}
              onChange={(e) => onRascunho({ ...emEdicao, fim: e.target.value, erro: "" })}
              className="h-8 px-2 text-xs"
              aria-label="Fim da jornada"
            />
          </TableCell>
          <TableCell className="whitespace-normal">
            <Input
              type="number"
              min={1}
              max={31}
              value={emEdicao.dias}
              onChange={(e) => onRascunho({ ...emEdicao, dias: e.target.value, erro: "" })}
              className="h-8 w-20 px-2 text-xs"
              aria-label="Dias sem folga"
            />
            {emEdicao.erro && <p className="mt-1 text-xs font-medium text-destructive">{emEdicao.erro}</p>}
          </TableCell>
          <TableCell>
            <AcoesLinha>
              <BotaoIcone rotulo="Salvar" icone={Check} onClick={onSalvar} />
              <BotaoIcone rotulo="Cancelar" icone={X} onClick={() => onRascunho(null)} />
            </AcoesLinha>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className={cn("font-mono tabular-nums", fora && "line-through")}>
            {formatarHoraLocal(linha.inicioJornada)}
          </TableCell>
          <TableCell className={cn("font-mono tabular-nums", fora && "line-through")}>
            {formatarHoraLocal(linha.fimJornada)}
            {diasDepois > 0 && <span className="ml-1 text-xs text-muted-foreground">+{diasDepois}</span>}
          </TableCell>
          <TableCell className="tabular-nums">{fora ? "—" : linha.diasSemFolga}</TableCell>
          <TableCell>
            <AcoesLinha>
              {podeEditar && (
                <BotaoIcone rotulo="Editar" icone={Pencil} disabled={rascunho !== null} onClick={onEditar} />
              )}
              {podeEditar && (
                <BotaoIcone
                  rotulo="Excluir (não era jornada)"
                  icone={Trash2}
                  perigo
                  disabled={rascunho !== null}
                  onClick={() => onEdicoes((atual) => ({ ...atual, ignoradas: [...atual.ignoradas, ...linha.ids] }))}
                />
              )}
              {linha.situacao === "IGNORADA" && (
                <BotaoIcone
                  rotulo="Trazer de volta"
                  icone={Undo2}
                  disabled={rascunho !== null}
                  onClick={() => onEdicoes((atual) => semEdicoesDe(atual, linha.id, linha.ids))}
                />
              )}
              {linha.situacao === "ABSORVIDA" && (
                <BotaoIcone
                  rotulo="Trazer de volta (contar como jornada)"
                  icone={Undo2}
                  disabled={rascunho !== null}
                  onClick={() => onEdicoes((atual) => ({ ...atual, semCorrecao: [...atual.semCorrecao, linha.id] }))}
                />
              )}
              {alteradaPorVoce && (
                <BotaoIcone
                  rotulo="Desfazer minha alteração"
                  icone={RotateCcw}
                  disabled={rascunho !== null}
                  onClick={() => onEdicoes((atual) => semEdicoesDe(atual, linha.id, linha.ids))}
                />
              )}
            </AcoesLinha>
          </TableCell>
        </>
      )}
    </TableRow>
  </>
)
}
