import { prisma } from "@/lib/prisma"
import { PRODUTO_VALORES, formatarProduto } from "@/lib/services/produto.service"
import { STATUS_VIAGEM_VALORES, formatarStatusViagem } from "@/lib/services/viagem-status.service"
import type { StatusViagem, TipoProduto, Turno } from "@prisma/client"

export type IndicadoresDashboard = {
  totalViagens: number
  porStatus: Array<{ status: StatusViagem; label: string; quantidade: number }>
  porProduto: Array<{ produto: TipoProduto | null; label: string; quantidade: number }>
  porDia: Array<{ dia: string; quantidade: number }>
  porTurno: Array<{ turno: Turno; label: string; quantidade: number }>
  comAviso: number
  extras: number
  topMotoristas: Array<{ motoristaId: number; nome: string; quantidade: number }>
  topClientesRotas: Array<{ nome: string; quantidade: number }>
  topClientesCancelamentos: Array<{ nome: string; quantidade: number }>
}

/**
 * Indicadores do dashboard de relatórios — agregados a partir de
 * `inicioPrevisto` dentro do período (o mesmo campo usado nos outros
 * relatórios/filtros de viagem). `deletadoEm: null` segue o padrão de todo
 * o resto do app (viagem deletada não aparece em relatório nenhum).
 */
export async function buscarIndicadoresDashboard(
  filialId: number,
  de: Date,
  ate: Date,
): Promise<IndicadoresDashboard> {
  const where = {
    filialId,
    deletadoEm: null,
    inicioPrevisto: { gte: de, lte: ate },
  }

  const [totalViagens, porStatusRaw, porProdutoRaw, porTurnoRaw, viagens, comAviso, extras, entregas] = await Promise.all([
    prisma.viagem.count({ where }),
    prisma.viagem.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.viagem.groupBy({ by: ["produto"], where, _count: { _all: true } }),
    prisma.viagem.groupBy({ by: ["turno"], where, _count: { _all: true } }),
    prisma.viagem.findMany({
      where,
      select: { inicioPrevisto: true, motorista: { select: { id: true, nome: true } } },
    }),
    prisma.viagem.count({
      where: {
        ...where,
        OR: [
          { avisoInterjornada: { not: null } },
          { avisoFrotaIndisponivel: { not: null } },
          { avisoFrotaProdutoIncompativel: { not: null } },
        ],
      },
    }),
    prisma.viagem.count({ where: { ...where, viagemExtra: true } }),
    // Cliente vive na Entrega (texto livre, sem FK) — uma viagem pode ter
    // várias entregas pro mesmo cliente, então dedupe por viagem.id abaixo
    // (ver topClientes*) em vez de contar linha de entrega direto.
    prisma.entrega.findMany({
      where: { viagem: where },
      select: { cliente: true, viagem: { select: { id: true, status: true } } },
    }),
  ])

  const contagemPorStatus = new Map(porStatusRaw.map((r) => [r.status, r._count._all]))
  const porStatus = STATUS_VIAGEM_VALORES.map((status) => ({
    status,
    label: formatarStatusViagem(status),
    quantidade: contagemPorStatus.get(status) ?? 0,
  }))

  const contagemPorProduto = new Map(porProdutoRaw.map((r) => [r.produto, r._count._all]))
  const porProduto = [...PRODUTO_VALORES, null].map((produto) => ({
    produto,
    label: formatarProduto(produto),
    quantidade: contagemPorProduto.get(produto) ?? 0,
  })).filter((item) => item.quantidade > 0 || item.produto !== null)

  const LABEL_TURNO: Record<Turno, string> = { MANHA: "Manhã", NOITE: "Noite" }
  const contagemPorTurno = new Map(porTurnoRaw.map((r) => [r.turno, r._count._all]))
  const porTurno = (["MANHA", "NOITE"] as const).map((turno) => ({
    turno,
    label: LABEL_TURNO[turno],
    quantidade: contagemPorTurno.get(turno) ?? 0,
  }))

  const porDiaMap = new Map<string, number>()
  const porMotoristaMap = new Map<number, { nome: string; quantidade: number }>()
  for (const v of viagens) {
    const dia = v.inicioPrevisto.toISOString().slice(0, 10)
    porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1)
    if (v.motorista) {
      const atual = porMotoristaMap.get(v.motorista.id) ?? { nome: v.motorista.nome, quantidade: 0 }
      atual.quantidade += 1
      porMotoristaMap.set(v.motorista.id, atual)
    }
  }
  const porDia = [...porDiaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, quantidade]) => ({ dia, quantidade }))
  const topMotoristas = [...porMotoristaMap.entries()]
    .map(([motoristaId, v]) => ({ motoristaId, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8)

  const viagensPorCliente = new Map<string, Set<number>>()
  const canceladasPorCliente = new Map<string, Set<number>>()
  for (const entrega of entregas) {
    const nome = entrega.cliente.trim()
    if (!nome) continue

    if (!viagensPorCliente.has(nome)) viagensPorCliente.set(nome, new Set())
    viagensPorCliente.get(nome)!.add(entrega.viagem.id)

    if (entrega.viagem.status === "CANCELADA") {
      if (!canceladasPorCliente.has(nome)) canceladasPorCliente.set(nome, new Set())
      canceladasPorCliente.get(nome)!.add(entrega.viagem.id)
    }
  }
  const topClientesRotas = [...viagensPorCliente.entries()]
    .map(([nome, ids]) => ({ nome, quantidade: ids.size }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8)
  const topClientesCancelamentos = [...canceladasPorCliente.entries()]
    .map(([nome, ids]) => ({ nome, quantidade: ids.size }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8)

  return {
    totalViagens,
    porStatus,
    porProduto,
    porDia,
    porTurno,
    comAviso,
    extras,
    topMotoristas,
    topClientesRotas,
    topClientesCancelamentos,
  }
}
