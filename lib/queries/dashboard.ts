import { prisma } from "@/lib/prisma"
import { PRODUTO_VALORES, formatarProduto } from "@/lib/services/produto.service"
import { STATUS_VIAGEM_VALORES, formatarStatusViagem } from "@/lib/services/viagem-status.service"
import type { StatusViagem, TipoProduto } from "@prisma/client"

export type IndicadoresDashboard = {
  totalViagens: number
  porStatus: Array<{ status: StatusViagem; label: string; quantidade: number }>
  porProduto: Array<{ produto: TipoProduto | null; label: string; quantidade: number }>
  porDia: Array<{ dia: string; quantidade: number }>
  comAviso: number
  extras: number
  topMotoristas: Array<{ motoristaId: number; nome: string; quantidade: number }>
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

  const [totalViagens, porStatusRaw, porProdutoRaw, viagens, comAviso, extras] = await Promise.all([
    prisma.viagem.count({ where }),
    prisma.viagem.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.viagem.groupBy({ by: ["produto"], where, _count: { _all: true } }),
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

  return { totalViagens, porStatus, porProduto, porDia, comAviso, extras, topMotoristas }
}
