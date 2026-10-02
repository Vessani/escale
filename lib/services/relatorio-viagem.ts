import type { StatusViagem } from "@prisma/client"

/**
 * Linha do tempo de uma viagem pro "Relatório da viagem": junta, em ordem,
 * o que o escalador e o motorista registraram — mudanças de status (do
 * histórico), saída, chegadas, despesas, trocas de motorista, problema
 * mecânico e o encerramento. Sem banco: recebe os dados prontos.
 */

export type TipoEvento = "STATUS" | "SAIDA" | "CHEGADA" | "DESPESA" | "TROCA" | "PROBLEMA" | "FIM"

type EventoViagem = { quando: Date; tipo: TipoEvento; titulo: string; detalhe?: string; quem?: string | null }

type MudancaStatus = { quando: Date; de: StatusViagem | null; para: StatusViagem; quem: string | null }

type DadosLinhaDoTempo = {
  rotuloStatus: (status: StatusViagem) => string
  mudancasStatus: MudancaStatus[]
  saida: { quando: Date; km: number | null; motivoAtraso: string | null } | null
  chegadas: Array<{ quando: Date; cliente: string; km: number; total: string }>
  despesas: Array<{ quando: Date; tipo: string; valor: string }>
  trocas: Array<{ quando: Date; de: string; para: string; km: number; local: string; motivo: string }>
  problema: { quando: Date; texto: string } | null
  fim: { quando: Date; status: "FINALIZADA" | "CANCELADA"; km: number | null } | null
}

/** Do histórico (antes/depois de cada alteração da viagem), só as trocas de status. */
export function mudancasDeStatus(
  registros: Array<{ criadoEm: Date; antes: unknown; depois: unknown; usuarioNome: string | null }>,
): MudancaStatus[] {
  const status = (snapshot: unknown) =>
    snapshot && typeof snapshot === "object" && "status" in snapshot ? ((snapshot as { status: StatusViagem }).status ?? null) : null
  return registros.flatMap((registro) => {
    const de = status(registro.antes)
    const para = status(registro.depois)
    return para && de !== para ? [{ quando: registro.criadoEm, de, para, quem: registro.usuarioNome }] : []
  })
}

export function montarLinhaDoTempo(dados: DadosLinhaDoTempo): EventoViagem[] {
  const eventos: EventoViagem[] = [
    ...dados.mudancasStatus.map((m) => ({
      quando: m.quando,
      tipo: "STATUS" as const,
      titulo: m.de ? `${dados.rotuloStatus(m.de)} → ${dados.rotuloStatus(m.para)}` : `Criada como ${dados.rotuloStatus(m.para)}`,
      quem: m.quem,
    })),
    ...(dados.saida
      ? [{
          quando: dados.saida.quando,
          tipo: "SAIDA" as const,
          titulo: "Saída",
          detalhe: [dados.saida.km !== null ? `km ${dados.saida.km.toLocaleString("pt-BR")}` : null, dados.saida.motivoAtraso ? `atraso: ${dados.saida.motivoAtraso}` : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        }]
      : []),
    ...dados.chegadas.map((c) => ({
      quando: c.quando,
      tipo: "CHEGADA" as const,
      titulo: `Chegada em ${c.cliente}`,
      detalhe: `km ${c.km.toLocaleString("pt-BR")} · descarregado ${c.total}`,
    })),
    ...dados.despesas.map((d) => ({ quando: d.quando, tipo: "DESPESA" as const, titulo: d.tipo, detalhe: d.valor })),
    ...dados.trocas.map((t) => ({
      quando: t.quando,
      tipo: "TROCA" as const,
      titulo: `Troca de motorista: ${t.de} → ${t.para}`,
      detalhe: `km ${t.km.toLocaleString("pt-BR")} · ${t.local} · ${t.motivo}`,
    })),
    ...(dados.problema ? [{ quando: dados.problema.quando, tipo: "PROBLEMA" as const, titulo: "Problema mecânico", detalhe: dados.problema.texto }] : []),
    ...(dados.fim
      ? [{
          quando: dados.fim.quando,
          tipo: "FIM" as const,
          titulo: dados.fim.status === "FINALIZADA" ? "Viagem encerrada" : "Viagem cancelada",
          detalhe: dados.fim.km !== null ? `km final ${dados.fim.km.toLocaleString("pt-BR")}` : undefined,
        }]
      : []),
  ]
  // Por minuto: chegada e troca vêm de um campo sem segundos (15:21:00) e a
  // saída é gravada com segundos (15:21:18) — no mesmo minuto vale a ordem
  // natural do que aconteceu (saída antes da chegada…), não os segundos.
  const ordem: Record<TipoEvento, number> = { STATUS: 0, SAIDA: 1, TROCA: 2, CHEGADA: 3, DESPESA: 4, PROBLEMA: 5, FIM: 6 }
  const minuto = (data: Date) => Math.floor(data.getTime() / 60_000)
  return eventos.sort((a, b) => minuto(a.quando) - minuto(b.quando) || ordem[a.tipo] - ordem[b.tipo] || a.quando.getTime() - b.quando.getTime())
}
