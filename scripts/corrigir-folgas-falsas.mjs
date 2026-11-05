// Corrige as folgas falsas gravadas antes da correção da reconciliação de
// folga: finalizar a viagem do dia marcava Folga (código 7) em quem acabou de
// trabalhar, zerando o ciclo. Não apaga nada e cada linha corrigida ganha um
// registro em RegistroAuditoria.
//
// Só simula, a não ser com --aplicar:
//   DATABASE_URL=... node scripts/corrigir-folgas-falsas.mjs
//   DATABASE_URL=... node scripts/corrigir-folgas-falsas.mjs --aplicar
//
// A URL vem só do ambiente (o .env não é lido), de propósito: quem roda
// escolhe o banco. Use a conexão direta, não o pooler.
//
// Entram:
// - dia com horário do relatório e código 7: trabalhou, com certeza. O código
//   volta a sair de "Dias Sem Folga", como no import;
// - dia sem horário, depois da cobertura do relatório, com viagem finalizada
//   que foi trabalho naquele dia (mesmo critério de filtroAtividadeNoDia em
//   lib/queries/motoristas.ts) e sem auditoria. O código segue o dia anterior.
//
// Ficam de fora: folga marcada à mão (tem auditoria) e dia já coberto pelo
// relatório sem o motorista nele (o relatório prevalece). Quem não dá pra
// calcular aparece na saída como "revisar" e não é alterado. O efeito em
// cadeia (dia seguinte gravado como 1º dia) só o próximo import corrige.

import pg from "pg"

const CODIGO_FOLGA = 7
const ULTIMO_DIA_DO_CICLO = 6
const UM_DIA_MS = 86_400_000

const aplicar = process.argv.includes("--aplicar")
const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL não definida (o .env não é lido — informe o banco no comando).")
  process.exit(1)
}

/** Código do dia a partir do dia conhecido anterior — null quando não dá pra saber. */
function codigoPeloDiaAnterior(anterior, dia) {
  if (!anterior) return null
  const dias = Math.round((Date.parse(dia) - Date.parse(anterior.dia)) / UM_DIA_MS)
  if (dias > CODIGO_FOLGA) return null
  if (anterior.codigo >= 1 && anterior.codigo <= ULTIMO_DIA_DO_CICLO) return Math.min(anterior.codigo + dias, ULTIMO_DIA_DO_CICLO)
  if (anterior.codigo === CODIGO_FOLGA) return ((dias - 1) % CODIGO_FOLGA) + 1
  return null
}

const CANDIDATOS = `
  SELECT r.id, r."motoristaId", r.data::text AS dia, r."inicioJornada" IS NOT NULL AS "comHorario", r."diasSemFolga",
         m.nome, m.seva, m."filialId"
  FROM "RegistroJornada" r
  JOIN "Motorista" m ON m.id = r."motoristaId"
  JOIN "Filial" f ON f.id = m."filialId"
  WHERE r.codigo = ${CODIGO_FOLGA} AND m."deletadoEm" IS NULL AND (
    r."inicioJornada" IS NOT NULL
    OR (
      (f."relatorioJornadaAte" IS NULL OR r.data >= f."relatorioJornadaAte")
      AND NOT EXISTS (
        SELECT 1 FROM "RegistroAuditoria" a WHERE a.entidade = 'RegistroJornada' AND a."entidadeId" = r.id::text
      )
      AND EXISTS (
        SELECT 1 FROM "Viagem" v
        WHERE (v."motoristaId" = r."motoristaId" OR v."motoristaAcompanhanteId" = r."motoristaId")
          AND v."deletadoEm" IS NULL
          AND v.status = 'FINALIZADA'
          AND v."inicioPrevisto" < r.data + interval '27 hours'
          AND (
            v."inicioPrevisto" >= r.data + interval '3 hours'
            OR v."finalizadoEm" >= r.data + interval '7 hours'
          )
      )
    )
  )
  ORDER BY r."motoristaId", r.data`

const client = new pg.Client({ connectionString: url })
await client.connect()

let concluido = false
try {
  await client.query("BEGIN")
  const { rows: candidatos } = await client.query(CANDIDATOS)

  const correcoes = []
  const revisar = []
  /** Último dia já resolvido por motorista: folgas falsas em dias seguidos usam a correção do dia anterior. */
  const ultimoDia = new Map()

  for (const candidato of candidatos) {
    let codigo
    if (candidato.comHorario) {
      codigo = candidato.diasSemFolga === null ? null : Math.max(1, Math.min(candidato.diasSemFolga, ULTIMO_DIA_DO_CICLO))
    } else {
      const { rows } = await client.query(
        `SELECT data::text AS dia, codigo FROM "RegistroJornada" WHERE "motoristaId" = $1 AND data < $2::date ORDER BY data DESC LIMIT 1`,
        [candidato.motoristaId, candidato.dia],
      )
      codigo = codigoPeloDiaAnterior(ultimoDia.get(candidato.motoristaId) ?? rows[0], candidato.dia)
    }

    if (codigo === null) {
      revisar.push(candidato)
      continue
    }
    correcoes.push({ ...candidato, codigo })
    ultimoDia.set(candidato.motoristaId, { dia: candidato.dia, codigo })
  }

  const descrever = ({ seva, nome, dia }) => `${dia}  ${seva}  ${nome}`
  console.log(aplicar ? "APLICANDO" : "SIMULAÇÃO (nada será gravado; use --aplicar)")
  console.log(`${correcoes.length} a corrigir, ${revisar.length} a revisar`)
  for (const correcao of correcoes) console.log(`  corrigir  ${descrever(correcao)}: Folga → ${correcao.codigo}º dia`)
  for (const item of revisar) console.log(`  revisar   ${descrever(item)}: sem como calcular o código`)

  if (aplicar) {
    for (const { id, filialId, codigo } of correcoes) {
      await client.query(`UPDATE "RegistroJornada" SET codigo = $1, "atualizadoEm" = now() WHERE id = $2`, [codigo, id])
      await client.query(
        `INSERT INTO "RegistroAuditoria" (entidade, "entidadeId", acao, antes, depois, "usuarioNome", "filialId")
         VALUES ('RegistroJornada', $1, 'ATUALIZACAO', $2, $3, 'Correção de folgas falsas (script)', $4)`,
        [String(id), JSON.stringify({ codigo: CODIGO_FOLGA }), JSON.stringify({ codigo }), filialId],
      )
    }
  }

  await client.query(aplicar ? "COMMIT" : "ROLLBACK")
  concluido = true
} finally {
  if (!concluido) await client.query("ROLLBACK").catch(() => {})
  await client.end()
}
