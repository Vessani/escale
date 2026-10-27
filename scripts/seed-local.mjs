// Dados de exemplo pro banco LOCAL (nunca rodar contra o Supabase).
// Chamado por scripts/db-local.sh --seed.
//
// Cria a filial "Joinville (local)", um ADMIN (admin@local.dev), três
// motoristas — o primeiro com acesso à área do motorista (SEVA 1001 + PIN) —
// e uma viagem em andamento. Senha e PIN são aleatórios e só aparecem no
// terminal; rodar de novo não duplica nada, só gera senha e PIN novos.

import { randomBytes, randomInt, randomUUID } from "node:crypto"
import pg from "pg"
import bcrypt from "bcrypt"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL não definida.")
  process.exit(1)
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Recusado: DATABASE_URL não aponta pra localhost. O seed é só pro banco local.")
  process.exit(1)
}

const EMAIL_ADMIN = "admin@local.dev"
const SEVA_COM_ACESSO = 1001
const senhaAdmin = randomBytes(9).toString("base64url")
const pin = String(randomInt(0, 1_000_000)).padStart(6, "0")

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query("BEGIN")
  const existente = await client.query(`SELECT "filialId" FROM "Usuario" WHERE email = $1`, [EMAIL_ADMIN])

  if (existente.rows.length > 0) {
    // Já semeado: só troca a senha e o PIN (que não dá pra recuperar do hash).
    await client.query(`UPDATE "Usuario" SET senha = $1, ativo = true WHERE email = $2`, [await bcrypt.hash(senhaAdmin, 10), EMAIL_ADMIN])
    await client.query(
      `UPDATE "Usuario" SET senha = $1, ativo = true, "versaoSessao" = "versaoSessao" + 1
        WHERE "motoristaId" = (SELECT id FROM "Motorista" WHERE seva = $2 AND "filialId" = $3)`,
      [await bcrypt.hash(pin, 10), SEVA_COM_ACESSO, existente.rows[0].filialId],
    )
    await client.query("COMMIT")
    console.log("Dados de exemplo já existiam — senha e PIN novos gerados.")
  } else {
    const filial = await client.query(`INSERT INTO "Filial" (nome) VALUES ('Joinville (local)') RETURNING id`)
    const filialId = filial.rows[0].id

    await client.query(`INSERT INTO "Usuario" (id, nome, email, senha, role, "filialId") VALUES ($1, 'Admin Local', $2, $3, 'ADMIN', $4)`, [
      randomUUID(),
      EMAIL_ADMIN,
      await bcrypt.hash(senhaAdmin, 10),
      filialId,
    ])

    const motoristas = [
      ["JOÃO DA SILVA", SEVA_COM_ACESSO],
      ["CARLOS PEREIRA", 1002],
      ["MARCOS OLIVEIRA", 1003],
    ]
    const ids = []
    for (const [nome, seva] of motoristas) {
      const r = await client.query(
        `INSERT INTO "Motorista" (nome, seva, "diasTrabalhados", turno, tipo, "produtosAutorizados", "filialId", "atualizadoEm")
         VALUES ($1, $2, 0, 'MANHA', 'MOTORISTA', ARRAY['OXIGENIO','NITROGENIO']::"TipoProduto"[], $3, now()) RETURNING id`,
        [nome, seva, filialId],
      )
      ids.push(r.rows[0].id)
    }

    // Acesso do primeiro motorista à área "Minhas viagens" (login = SEVA + PIN).
    await client.query(
      `INSERT INTO "Usuario" (id, nome, senha, role, "filialId", "motoristaId") VALUES ($1, $2, $3, 'MOTORISTA', $4, $5)`,
      [randomUUID(), motoristas[0][0], await bcrypt.hash(pin, 10), filialId, ids[0]],
    )

    // Uma viagem em andamento pro primeiro motorista, pra testar o vínculo do estouro com a viagem.
    await client.query(
      `INSERT INTO "Viagem" ("numViagem", carreta, cavalo, tanque, "inicioPrevisto", "fimPrevisto", turno, "diasViagem",
                             produto, status, "motoristaId", "filialId", "horarioRealSaida", "atualizadoEm")
       VALUES ('LOCAL-0001', 'ABC1D23', 'XYZ9K87', 'T-01', now() - interval '6 hours', now() + interval '4 hours', 'MANHA', 1,
               'OXIGENIO', 'INICIADA', $1, $2, now() - interval '6 hours', now())`,
      [ids[0], filialId],
    )

    await client.query("COMMIT")
    console.log("Seed aplicado: filial Joinville (local), admin, 3 motoristas e 1 viagem em andamento.")
  }

  console.log(`
  Escalador (ADMIN):  ${EMAIL_ADMIN} / ${senhaAdmin}
  Motorista:          matrícula (SEVA) ${SEVA_COM_ACESSO} / PIN ${pin}
`)
} catch (erro) {
  await client.query("ROLLBACK").catch(() => {})
  console.error("Falha no seed:", erro.message)
  process.exitCode = 1
} finally {
  await client.end()
}
