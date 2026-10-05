"use client"

import type { TipoMotorista } from "@prisma/client"
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectValue } from "@/components/ui/select"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { IndicadorCompatibilidade, type SituacaoMotorista } from "@/components/motorista/indicador-compatibilidade"
import { podeSerAcompanhante, podeSerPrincipal } from "@/lib/services/tipo-motorista"

export type OpcaoMotorista = {
  id: number
  nome: string
  tipo: TipoMotorista
  situacao: SituacaoMotorista
  /** Por que está fora da regra — aparece ao lado do nome. */
  motivo?: string | null
}

const ORDEM_SITUACAO: Record<SituacaoMotorista, number> = {
  OK: 0,
  SEM_DESCANSO: 1,
  FORA_DA_REGRA: 2,
  FORA_DA_REGRA_SEM_DESCANSO: 3,
}

function ItemMotorista({ motorista, mostrarSituacao }: { motorista: OpcaoMotorista; mostrarSituacao: boolean }) {
  return (
    <SelectItem value={String(motorista.id)}>
      <span className="flex min-w-0 items-center gap-2">
        {mostrarSituacao && <IndicadorCompatibilidade situacao={motorista.situacao} />}
        <NomeMotorista nome={motorista.nome} tipo={motorista.tipo} />
        {mostrarSituacao && motorista.motivo && <span className="truncate text-xs text-muted-foreground">· {motorista.motivo}</span>}
      </span>
    </SelectItem>
  )
}

/**
 * Opções de motorista PRINCIPAL: ponto de compatibilidade + nome + ícone do
 * tipo, agrupadas em "Disponíveis" (compatível e livre) e "Com restrição"
 * (o resto, em ordem de gravidade) — no lugar dos rótulos "(Compatível)",
 * "(Emergência)" etc. repetidos em cada nome. Quem não pode ser principal
 * (em treinamento, enchedor) nem aparece, a não ser que já seja o escolhido
 * (viagem antiga), pra o select não ficar sem valor.
 */
export function OpcoesMotoristaPrincipal({
  motoristas,
  selecionadoId,
}: {
  motoristas: OpcaoMotorista[]
  selecionadoId: number | null
}) {
  const elegiveis = motoristas
    .filter((motorista) => podeSerPrincipal(motorista.tipo) || motorista.id === selecionadoId)
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.nome.localeCompare(b.nome))

  const disponiveis = elegiveis.filter((motorista) => motorista.situacao === "OK")
  const comRestricao = elegiveis.filter((motorista) => motorista.situacao !== "OK")

  if (elegiveis.length === 0) {
    return (
      <SelectItem value="0" disabled>
        Nenhum motorista cadastrado
      </SelectItem>
    )
  }

  return (
    <>
      {disponiveis.length > 0 && (
        <SelectGroup>
          <SelectLabel>Disponíveis</SelectLabel>
          {disponiveis.map((motorista) => (
            <ItemMotorista key={motorista.id} motorista={motorista} mostrarSituacao />
          ))}
        </SelectGroup>
      )}
      {disponiveis.length > 0 && comRestricao.length > 0 && <SelectSeparator />}
      {comRestricao.length > 0 && (
        <SelectGroup>
          <SelectLabel>Com restrição</SelectLabel>
          {comRestricao.map((motorista) => (
            <ItemMotorista key={motorista.id} motorista={motorista} mostrarSituacao />
          ))}
        </SelectGroup>
      )}
    </>
  )
}

/** Opções de ACOMPANHANTE: todo mundo que viaja (enchedor fica de fora), com o ícone do tipo. */
export function OpcoesMotoristaAcompanhante({
  motoristas,
  selecionadoId,
}: {
  motoristas: Array<Pick<OpcaoMotorista, "id" | "nome" | "tipo">>
  selecionadoId: number | null
}) {
  return (
    <>
      {motoristas
        .filter((motorista) => podeSerAcompanhante(motorista.tipo) || motorista.id === selecionadoId)
        .map((motorista) => (
          <SelectItem key={motorista.id} value={String(motorista.id)}>
            <NomeMotorista nome={motorista.nome} tipo={motorista.tipo} />
          </SelectItem>
        ))}
    </>
  )
}

/**
 * Valor exibido no seletor fechado, montado aqui em vez de copiado da opção
 * pelo Radix — assim o nome já vem pronto do servidor, sem piscar vazio até
 * o JavaScript carregar.
 */
export function ValorMotoristaSelecionado({
  opcoes,
  selecionadoId,
  mostrarSituacao,
  placeholder,
}: {
  opcoes: OpcaoMotorista[]
  selecionadoId: number | null
  mostrarSituacao: boolean
  placeholder: string
}) {
  const selecionado = selecionadoId === null ? undefined : opcoes.find((opcao) => opcao.id === selecionadoId)

  if (!selecionado) {
    // Texto explícito também no vazio: o acompanhante usa o valor "nenhum"
    // (não vazio), e aí o Radix não mostraria o placeholder antes de carregar.
    return (
      <SelectValue placeholder={placeholder}>
        <span className="text-muted-foreground">{placeholder}</span>
      </SelectValue>
    )
  }

  return (
    <SelectValue placeholder={placeholder}>
      <span className="flex min-w-0 items-center gap-2">
        {mostrarSituacao && <IndicadorCompatibilidade situacao={selecionado.situacao} />}
        <NomeMotorista nome={selecionado.nome} tipo={selecionado.tipo} />
      </span>
    </SelectValue>
  )
}
