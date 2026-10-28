#!/usr/bin/env bash
# Prepara o PostgreSQL LOCAL do Escalador (docker-compose.yml), pra testar
# antes de levar pro Supabase.
#
# Uso:
#   scripts/db-local.sh                # sobe o banco e deixa as tabelas em dia
#   scripts/db-local.sh --seed         # idem + dados de exemplo (filial, admin e um motorista com acesso)
#   scripts/db-local.sh --reset        # APAGA o banco local (volume) e recria do zero
#   scripts/db-local.sh --sem-docker   # usa um Postgres já rodando (DATABASE_URL do .env)
#
# Por que não é só `prisma migrate deploy`: o histórico de migrations do repo
# não tem a migration inicial (o banco original nasceu de um `db push`), então
# num banco VAZIO a primeira migration falha (P3018). Num banco vazio, este
# script cria as tabelas direto do schema.prisma (db push), recria os índices
# únicos parciais e o RLS que só existem nas migrations, e marca todas as
# migrations como aplicadas — mesmo estado do Supabase. Num banco que já tem
# o histórico, só roda `prisma migrate deploy` (aplica as novas).
set -euo pipefail

cd "$(dirname "$0")/.."

USAR_DOCKER=1
SEED=0
RESET=0
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --reset) RESET=1 ;;
    --sem-docker) USAR_DOCKER=0 ;;
    -h | --help)
      sed -n 2,10p "$0"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

info() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
erro() {
  printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2
  exit 1
}

[ -f .env ] || erro "Falta o .env. Copie o .env.example (cp .env.example .env) e preencha POSTGRES_* e DATABASE_URL."

# DATABASE_URL vem do .env (o mesmo que o app e o Prisma usam), a não ser que já esteja no ambiente.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
fi
[ -n "${DATABASE_URL:-}" ] || erro "Defina DATABASE_URL no .env apontando pro Postgres local."
case "$DATABASE_URL" in
  *supabase.co* | *supabase.com* | *pooler.supabase*) erro "DATABASE_URL aponta pro Supabase. Este script é só pro banco local." ;;
  *localhost* | *127.0.0.1*) ;;
  *) erro "DATABASE_URL não aponta pra localhost. Este script é só pro banco local." ;;
esac
export DATABASE_URL
# O prisma.config.ts usa DIRECT_URL antes de DATABASE_URL — garante que vai no local.
export DIRECT_URL="$DATABASE_URL"

# ---------------------------------------------------------------- banco
if [ "$USAR_DOCKER" = 1 ]; then
  command -v docker >/dev/null || erro "Docker não encontrado. Instale (Arch: sudo pacman -S docker docker-compose && sudo systemctl enable --now docker) ou rode com --sem-docker."
  docker info >/dev/null 2>&1 || erro "O Docker está instalado mas não está rodando (sudo systemctl start docker) ou seu usuário não está no grupo docker."

  if [ "$RESET" = 1 ]; then
    printf '\033[1;33mIsso APAGA todos os dados do banco local (volume do docker-compose). Digite "apagar" para continuar: \033[0m'
    read -r resposta
    [ "$resposta" = "apagar" ] || erro "Cancelado."
    info "Apagando o banco local"
    docker compose down -v
  fi

  info "Subindo o Postgres (docker compose)"
  docker compose up -d --wait
elif [ "$RESET" = 1 ]; then
  erro "--reset só funciona com o Docker. Sem Docker, apague o banco você mesmo."
fi

# ------------------------------------------------------------- tabelas
consulta() { node --input-type=module -e "
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
// Com vários comandos o pg devolve uma lista de resultados: vale o último.
const r = [].concat(await c.query(process.argv[1])).at(-1)
console.log((r.rows ?? []).map((x) => Object.values(x)[0]).join('\n'))
await c.end()
" "$1"; }

TEM_HISTORICO="$(consulta "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS t")"

if [ "$TEM_HISTORICO" = "true" ]; then
  info "Banco já tem histórico de migrations: aplicando só as novas"
  npx prisma migrate deploy
else
  info "Banco vazio: criando as tabelas a partir do schema.prisma"
  npx prisma db push

  # Unicidade só entre registros ativos (deletadoEm IS NULL): o Prisma não sabe
  # expressar isso no schema, então vive só nas migrations. Mantenha esta lista
  # igual aos índices "..._ativa_key" vigentes em prisma/migrations.
  info "Criando os índices únicos parciais"
  consulta '
    CREATE UNIQUE INDEX IF NOT EXISTS "Cliente_numeroSap_ativa_key" ON "Cliente"("numeroSap") WHERE "deletadoEm" IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "Frota_filialId_cavalo_carreta_ativa_key" ON "Frota"("filialId", "cavalo", "carreta") WHERE "deletadoEm" IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "Viagem_filialId_numViagem_ativa_key" ON "Viagem"("filialId", "numViagem") WHERE "deletadoEm" IS NULL;
  ' >/dev/null

  info "Marcando as migrations como aplicadas (o banco já está no estado final)"
  for pasta in prisma/migrations/*/; do
    nome="$(basename "$pasta")"
    [ -f "$pasta/migration.sql" ] || continue
    if ! saida="$(npx prisma migrate resolve --applied "$nome" 2>&1)"; then
      echo "$saida" >&2
      erro "Não foi possível marcar $nome como aplicada."
    fi
    echo "  ✓ $nome"
  done

  # Depois do resolve, que é quem cria a _prisma_migrations: no Supabase todas
  # as tabelas do public têm RLS (ver prisma/migrations-rls.test.ts).
  info "Ligando o RLS em todas as tabelas"
  consulta "
    DO \$\$ DECLARE t text; BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END \$\$;
  " >/dev/null
fi

# ------------------------------------------------------------ seed
if [ "$SEED" = 1 ]; then
  info "Inserindo dados de exemplo"
  node scripts/seed-local.mjs
fi

printf '\n\033[1;32m✔ Banco local pronto.\033[0m\n\nDepois: npm run dev  →  http://localhost:3000\n'
cat <<'EOF'

Pra abrir o link de aprovação no CELULAR (mesma rede wifi), troque o
NEXTAUTH_URL do .env pelo IP da máquina, ex: http://192.168.0.10:3000, e rode
"npm run dev -- -H 0.0.0.0".

Levar pro Supabase depois: com DIRECT_URL do Supabase (porta 5432),
"npx prisma migrate deploy" aplica só as migrations novas.
EOF
