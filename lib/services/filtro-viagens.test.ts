import { describe, expect, it } from "vitest"
import { DIAS_MAXIMOS_PERIODO, montarQueryFiltroViagens, parseFiltroListaViagens } from "./filtro-viagens"
import { parseDataLocal } from "@/lib/utils/date-format"

const AGORA = new Date("2026-09-30T13:00:00-03:00")

describe("parseFiltroListaViagens", () => {
  it("sem parâmetros: todos os status, 7 dias pra trás e 30 pra frente, página 1", () => {
    const filtro = parseFiltroListaViagens({}, AGORA)

    expect(filtro.status).toBe("TODOS")
    expect(filtro.de).toEqual(parseDataLocal("2026-09-23"))
    expect(filtro.ate).toEqual(parseDataLocal("2026-10-30"))
    expect(filtro.busca).toBe("")
    expect(filtro.pagina).toBe(1)
  })

  it("lê status, período, busca e página da URL", () => {
    const filtro = parseFiltroListaViagens({ status: "INICIADA", de: "2026-09-01", ate: "2026-09-10", q: " 9220 ", pagina: "3" }, AGORA)

    expect(filtro).toEqual({
      status: "INICIADA",
      de: parseDataLocal("2026-09-01"),
      ate: parseDataLocal("2026-09-10"),
      busca: "9220",
      pagina: 3,
    })
  })

  it("valores inválidos caem no padrão em vez de quebrar a página", () => {
    const filtro = parseFiltroListaViagens({ status: "XPTO", de: "31/12/2026", pagina: "-2" }, AGORA)

    expect(filtro.status).toBe("TODOS")
    expect(filtro.de).toEqual(parseDataLocal("2026-09-23"))
    expect(filtro.pagina).toBe(1)
  })

  it("inverte período ao contrário e limita o tamanho máximo", () => {
    const invertido = parseFiltroListaViagens({ de: "2026-09-10", ate: "2026-09-01" }, AGORA)
    expect(invertido.de).toEqual(parseDataLocal("2026-09-01"))

    const enorme = parseFiltroListaViagens({ de: "2020-01-01", ate: "2026-09-30" }, AGORA)
    expect((enorme.ate.getTime() - enorme.de.getTime()) / 86_400_000).toBe(DIAS_MAXIMOS_PERIODO)
  })
})

describe("montarQueryFiltroViagens", () => {
  it("monta links mantendo o filtro atual e trocando só o que mudou", () => {
    const filtro = parseFiltroListaViagens({ status: "CRIADA", de: "2026-09-01", ate: "2026-09-10" }, AGORA)

    expect(montarQueryFiltroViagens(filtro, { pagina: 2 })).toBe("?status=CRIADA&de=2026-09-01&ate=2026-09-10&pagina=2")
  })

  it("com busca, o período sai do link", () => {
    const filtro = parseFiltroListaViagens({ q: "922087" }, AGORA)

    expect(montarQueryFiltroViagens(filtro)).toBe("?q=922087")
  })
})
