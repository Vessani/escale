import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * No Supabase, tabela do schema public sem RLS fica aberta pela API REST
 * pública. Toda tabela criada numa migration precisa de
 * `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY` (em qualquer migration) —
 * este teste falha se alguém esquecer, antes de chegar em produção.
 */
describe("migrations: toda tabela tem RLS", () => {
  const pasta = join(__dirname, "migrations")
  const sqls = readdirSync(pasta, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => readFileSync(join(pasta, item.name, "migration.sql"), "utf8"))
    .join("\n")

  const criadas = [...sqls.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:"?public"?\.)?"?(\w+)"?/gi)].map((m) => m[1])
  const comRls = new Set(
    [...sqls.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:"?public"?\.)?"?(\w+)"? ENABLE ROW LEVEL SECURITY/gi)].map((m) => m[1]),
  )
  const desligadas = [...sqls.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:"?public"?\.)?"?(\w+)"? DISABLE ROW LEVEL SECURITY/gi)].map(
    (m) => m[1],
  )

  it("nenhuma tabela criada sem ENABLE ROW LEVEL SECURITY", () => {
    expect(criadas.length).toBeGreaterThan(10)
    expect(criadas.filter((tabela) => !comRls.has(tabela))).toEqual([])
  })

  it("nenhuma migration desliga RLS", () => {
    expect(desligadas).toEqual([])
  })
})
