import { describe, expect, it, vi } from "vitest"
import {
  deveRetirarMotoristaDaFolga,
  marcarInternoQuemSaiuDaEscala,
  reconciliarFolgaMotoristasNoDiaAtual,
} from "@/lib/services/folga.service"

function criarTx() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    motorista: { findMany: vi.fn(), update: vi.fn() },
    registroJornada: { upsert: vi.fn().mockResolvedValue({}) },
  }
}

type ViagemFake = { deletadoEm: Date | null; status: string; inicioPrevisto: Date; fimPrevisto: Date; finalizadoEm?: Date | null }
type MotoristaFake = {
  id: number
  deletadoEm?: Date | null
  diasTrabalhados: number
  viagens?: ViagemFake[]
  /** Viagens onde ele é acompanhante — também contam como atividade hoje (ver folga.service.ts). */
  viagensComoAcompanhante?: ViagemFake[]
  /** Como vem da coluna @db.Date: meia-noite UTC. */
  registrosJornada?: Array<{ data: Date; codigo: number; fimJornada: Date | null }>
}
type JanelaDoDia = { OR: [{ inicioPrevisto: { gte: Date } }, { fimPrevisto: { gte: Date }; finalizadoEm?: { gte: Date } }] }
type FiltroViagem = {
  inicioPrevisto: { lte: Date }
  OR: [JanelaDoDia & { status: { notIn: string[] } }, JanelaDoDia & { status: string }]
}

/**
 * Fake fiel à query de `reconciliarFolgaMotoristasNoDiaAtual`: avalia de
 * verdade o filtro de atividade contra as viagens em memória, em vez de
 * decidir a resposta na mão — assim o teste pega um erro na conta de "hoje".
 */
function criarFindManyFiel(motoristas: MotoristaFake[]) {
  return vi.fn((args: { where: { id: { in: number[] } }; select: { viagens: { where: FiltroViagem } } }) => {
    const filtro = args.select.viagens.where
    const [ativa, finalizada] = filtro.OR
    const naJanela = (v: ViagemFake, { OR: [comecou, terminou] }: JanelaDoDia) =>
      v.inicioPrevisto.getTime() >= comecou.inicioPrevisto.gte.getTime() ||
      (v.fimPrevisto.getTime() >= terminou.fimPrevisto.gte.getTime() &&
        (!terminou.finalizadoEm || (v.finalizadoEm?.getTime() ?? 0) >= terminou.finalizadoEm.gte.getTime()))
    const daAtividade = (viagens: ViagemFake[] = []) =>
      viagens.filter(
        (v) =>
          v.deletadoEm === null &&
          v.inicioPrevisto.getTime() <= filtro.inicioPrevisto.lte.getTime() &&
          (v.status === finalizada.status ? naJanela(v, finalizada) : !ativa.status.notIn.includes(v.status) && naJanela(v, ativa)),
      )

    return Promise.resolve(
      motoristas
        .filter((m) => args.where.id.in.includes(m.id) && !m.deletadoEm)
        .map((m) => ({
          id: m.id,
          diasTrabalhados: m.diasTrabalhados,
          filial: null,
          registrosJornada: m.registrosJornada ?? [],
          viagens: daAtividade(m.viagens),
          viagensComoAcompanhante: daAtividade(m.viagensComoAcompanhante),
        })),
    )
  })
}

async function reconciliar(
  motoristas: MotoristaFake[],
  janelas: Array<{ inicioPrevisto: Date; fimPrevisto: Date }>,
  dataReferencia?: Date,
  ids: Array<number | null> = motoristas.map((m) => m.id),
) {
  const tx = criarTx()
  tx.motorista.findMany = criarFindManyFiel(motoristas) as never
  await reconciliarFolgaMotoristasNoDiaAtual(tx as never, ids, janelas, dataReferencia)
  return tx
}

const codigoGravado = (tx: ReturnType<typeof criarTx>) =>
  (vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { create: { codigo: number } }).create.codigo

describe("folga.service", () => {
  describe("deveRetirarMotoristaDaFolga", () => {
    it("retira da folga quando está em Folga (7) e surge uma viagem ativa hoje", () => {
      expect(deveRetirarMotoristaDaFolga(7, true)).toBe(true)
    })

    it("mantém em folga quando está em Folga (7) mas não há viagem ativa hoje", () => {
      expect(deveRetirarMotoristaDaFolga(7, false)).toBe(false)
    })

    it("não se aplica a quem não está em Folga (7), mesmo com viagem ativa", () => {
      expect(deveRetirarMotoristaDaFolga(1, true)).toBe(false)
      expect(deveRetirarMotoristaDaFolga(6, true)).toBe(false)
      expect(deveRetirarMotoristaDaFolga(8, true)).toBe(false)
    })
  })

  describe("reconciliarFolgaMotoristasNoDiaAtual", () => {
    const bsb = (iso: string) => new Date(`${iso}-03:00`)
    const viagemEm = (inicioPrevisto: Date, fimPrevisto: Date, extra: Partial<ViagemFake> = {}): ViagemFake => ({
      deletadoEm: null,
      status: "ALOCADA",
      inicioPrevisto,
      fimPrevisto,
      ...extra,
    })
    const noDia = (dia: string, codigo: number) => ({ data: new Date(`${dia}T00:00:00.000Z`), codigo, fimJornada: null })

    it("tira o motorista da folga quando uma viagem é criada pra ele hoje", async () => {
      const agora = new Date()
      const viagem = viagemEm(agora, agora)

      const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagem] }], [viagem], agora)

      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
      const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { where: { motoristaId_data: { motoristaId: number } } }
      expect(upsertArgs.where.motoristaId_data.motoristaId).toBe(5)
      expect(codigoGravado(tx)).toBe(1)
      expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { diasTrabalhados: 1 } })
    })

    it("nunca marca Folga em quem ficou sem viagem hoje, em nenhum dia do ciclo", async () => {
      const agora = new Date()
      const cancelada = viagemEm(agora, agora, { status: "CANCELADA" })

      for (let dia = 1; dia <= 6; dia++) {
        const tx = await reconciliar([{ id: 8, diasTrabalhados: dia, viagens: [cancelada] }], [cancelada], agora)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
        expect(tx.motorista.update).not.toHaveBeenCalled()
      }
    })

    it("não consulta o banco quando nenhum id relevante é informado", async () => {
      const tx = criarTx()

      await reconciliarFolgaMotoristasNoDiaAtual(tx as never, [null, undefined], [])

      expect(tx.motorista.findMany).not.toHaveBeenCalled()
    })

    it("remove ids duplicados antes de consultar o banco", async () => {
      const agora = new Date()

      const tx = await reconciliar([], [{ inicioPrevisto: agora, fimPrevisto: agora }], agora, [5, 5, null])

      const primeiraChamada = vi.mocked(tx.motorista.findMany).mock.calls[0][0] as { where: { id: { in: number[] } } }
      expect(primeiraChamada.where.id.in).toEqual([5])
    })

    it("viagem da noite de ontem que chega de madrugada não tira o motorista da folga de hoje", async () => {
      const hoje = bsb("2026-10-06T01:30:00")
      const daNoiteDeOntem = viagemEm(bsb("2026-10-05T20:00:00"), bsb("2026-10-06T03:00:00"), { status: "INICIADA" })

      const naoSai = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [daNoiteDeOntem] }], [daNoiteDeOntem], hoje)
      expect(naoSai.registroJornada.upsert).not.toHaveBeenCalled()

      // Já se a chegada passa das 04:00, é trabalho no dia: sai da folga.
      const chegaDepois = { ...daNoiteDeOntem, fimPrevisto: bsb("2026-10-06T06:00:00") }
      const sai = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [chegaDepois] }], [chegaDepois], hoje)
      expect(sai.registroJornada.upsert).toHaveBeenCalledTimes(1)
    })

    describe("viagem finalizada", () => {
      const hoje = bsb("2026-10-06T21:00:00")
      const finalizada = (inicio: string, fim: string, finalizadoEm: string) =>
        viagemEm(bsb(inicio), bsb(fim), { status: "FINALIZADA", finalizadoEm: bsb(finalizadoEm) })

      it("encerrar a viagem de hoje não marca Folga em quem trabalhou hoje", async () => {
        const viagem = finalizada("2026-10-06T08:00:00", "2026-10-06T18:00:00", "2026-10-06T18:30:00")

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 2, viagens: [viagem] }], [viagem], hoje)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      })

      it("encerrar hoje a viagem que veio de ontem também não marca Folga", async () => {
        const viagem = finalizada("2026-10-05T08:00:00", "2026-10-06T18:00:00", "2026-10-06T10:00:00")

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 2, viagens: [viagem] }], [viagem], hoje)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      })

      it("viagem prevista até hoje, mas encerrada ontem, não tira o motorista da folga de hoje", async () => {
        const viagem = finalizada("2026-10-04T08:00:00", "2026-10-06T18:00:00", "2026-10-05T16:00:00")

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagem] }], [viagem], hoje)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      })

      it("viagem da noite encerrada de madrugada não tira o motorista da folga de hoje", async () => {
        const viagem = finalizada("2026-10-05T20:00:00", "2026-10-06T03:00:00", "2026-10-06T03:10:00")

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagem] }], [viagem], hoje)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      })
    })

    describe("decide pelo código projetado, não pelo cache diasTrabalhados", () => {
      const hoje = bsb("2026-10-06T12:00:00")
      const viagemDeHoje = viagemEm(bsb("2026-10-06T08:00:00"), bsb("2026-10-06T18:00:00"))
      const janela = [viagemDeHoje]

      it("cache 7 parado não zera o ciclo de quem está no 4º dia", async () => {
        const registrosJornada = [noDia("2026-10-02", 7), noDia("2026-10-03", 1), noDia("2026-10-04", 2), noDia("2026-10-05", 3)]

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagemDeHoje], registrosJornada }], janela, hoje)

        expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      })

      it("Folga projetada sai da folga mesmo com o cache num dia de trabalho", async () => {
        const registrosJornada = [noDia("2026-10-05", 7), noDia("2026-10-06", 7)]

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 3, viagens: [viagemDeHoje], registrosJornada }], janela, hoje)

        expect(codigoGravado(tx)).toBe(1)
      })
    })

    describe("código de quem trabalha num dia de Folga", () => {
      const hoje = bsb("2026-10-06T12:00:00")
      const viagemDeHoje = viagemEm(bsb("2026-10-06T08:00:00"), bsb("2026-10-06T18:00:00"))
      const trabalhandoCom = (registrosJornada: MotoristaFake["registrosJornada"]) =>
        reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagemDeHoje], registrosJornada }], [viagemDeHoje], hoje)

      it("depois do 6º dia continua no 6: não esconde o 7º dia seguido zerando o ciclo", async () => {
        expect(codigoGravado(await trabalhandoCom([noDia("2026-10-05", 6)]))).toBe(6)
      })

      it("no meio do ciclo, a folga marcada hoje é desfeita e o ciclo segue", async () => {
        expect(codigoGravado(await trabalhandoCom([noDia("2026-10-05", 3), noDia("2026-10-06", 7)]))).toBe(4)
      })

      it("sem saber de ontem, recomeça no 1º dia", async () => {
        expect(codigoGravado(await trabalhandoCom([noDia("2026-10-06", 7)]))).toBe(1)
      })
    })

    describe("marcarInternoQuemSaiuDaEscala", () => {
      const hoje = bsb("2026-10-06T12:00:00")
      const viagemDeHoje = viagemEm(bsb("2026-10-06T08:00:00"), bsb("2026-10-06T18:00:00"))
      const noDiaDeHoje = (codigo: number) => [noDia("2026-10-06", codigo)]
      async function marcar(motorista: MotoristaFake, viagemAntes: ViagemFake = viagemDeHoje) {
        const tx = criarTx()
        tx.motorista.findMany = criarFindManyFiel([motorista]) as never
        await marcarInternoQuemSaiuDaEscala(tx as never, [motorista.id], viagemAntes, hoje)
        return tx
      }

      it("quem estava no meio do ciclo e perdeu a viagem de hoje fica Interno", async () => {
        expect(codigoGravado(await marcar({ id: 5, diasTrabalhados: 3 }))).toBe(10)
      })

      it("quem estava de Folga e foi escalado também fica Interno, sem voltar à folga", async () => {
        expect(codigoGravado(await marcar({ id: 5, diasTrabalhados: 7, registrosJornada: noDiaDeHoje(7) }))).toBe(10)
      })

      it("se ainda tem outra viagem hoje, não muda nada", async () => {
        const outra = viagemEm(bsb("2026-10-06T19:00:00"), bsb("2026-10-06T22:00:00"))

        expect((await marcar({ id: 5, diasTrabalhados: 3, viagens: [outra] })).registroJornada.upsert).not.toHaveBeenCalled()
      })

      it("Férias, Exames e Manutenção não viram Interno", async () => {
        for (const codigo of [8, 9, 11]) {
          const tx = await marcar({ id: 5, diasTrabalhados: 3, registrosJornada: noDiaDeHoje(codigo) })

          expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
        }
      })

      it("viagem que não era trabalho hoje não muda nada e nem consulta o banco", async () => {
        const deAmanha = viagemEm(bsb("2026-10-07T08:00:00"), bsb("2026-10-07T18:00:00"))
        const daMadrugada = viagemEm(bsb("2026-10-05T20:00:00"), bsb("2026-10-06T03:00:00"))

        for (const viagem of [deAmanha, daMadrugada]) {
          const tx = await marcar({ id: 5, diasTrabalhados: 3 }, viagem)

          expect(tx.motorista.findMany).not.toHaveBeenCalled()
        }
      })
    })

    it("viagem agendada só pra amanhã não tira o motorista da folga hoje", async () => {
      const hoje = new Date("2026-07-10T12:00:00")
      const viagem = viagemEm(new Date("2026-07-11T08:00:00"), new Date("2026-07-11T20:00:00"))

      // A janela relevante é a da viagem que disparou a chamada (amanhã) — não toca hoje.
      const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagem] }], [viagem], hoje)

      expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      expect(tx.motorista.update).not.toHaveBeenCalled()
      // Nem chega a consultar o banco — a janela já descarta antes da query
      // (é justamente essa checagem que faltava: criar/editar uma viagem
      // futura não deveria mexer no status de folga de hoje).
      expect(tx.motorista.findMany).not.toHaveBeenCalled()
    })

    it("criar uma viagem futura pra um motorista SEM nenhuma outra viagem hoje não marca ele como 'de folga hoje' — bug encontrado numa simulação de 30 dias", async () => {
      const hoje = new Date("2026-07-10T12:00:00")

      // A viagem que disparou a chamada é daqui a 4 dias — não toca hoje.
      const tx = await reconciliar(
        [{ id: 9, diasTrabalhados: 3 }],
        [{ inicioPrevisto: new Date("2026-07-14T08:00:00"), fimPrevisto: new Date("2026-07-14T20:00:00") }],
        hoje,
      )

      expect(tx.motorista.findMany).not.toHaveBeenCalled()
      expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      expect(tx.motorista.update).not.toHaveBeenCalled()
    })

    it("tira o motorista da folga quando ele tem atividade hoje só como acompanhante (não como principal)", async () => {
      const hoje = new Date("2026-07-10T12:00:00")
      const viagem = viagemEm(new Date("2026-07-10T08:00:00"), new Date("2026-07-10T20:00:00"))

      const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagensComoAcompanhante: [viagem] }], [viagem], hoje)

      expect(codigoGravado(tx)).toBe(1)
    })

    it("atualiza o cache quando a reconciliação roda no próprio dia da viagem", async () => {
      // registrarJornadaNoDia só atualiza o cache diasTrabalhados quando o dia
      // registrado é "hoje" de verdade (new Date() interno) — por isso fixamos
      // o relógio no dia da viagem, simulando a reconciliação rodando nesse dia.
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-07-11T09:00:00"))

      try {
        const viagem = viagemEm(new Date("2026-07-11T08:00:00"), new Date("2026-07-11T20:00:00"))

        const tx = await reconciliar([{ id: 5, diasTrabalhados: 7, viagens: [viagem] }], [viagem])

        expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
        expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { diasTrabalhados: 1 } })
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
