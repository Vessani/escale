#!/bin/sh
# Build da Vercel (ver vercel.json). Aplica as migrations pendentes ANTES do
# build, só no deploy de produção — senão o código novo pode subir antes da
# coluna que ele usa existir (ex: Viagem.finalizadoEm) e quebrar em runtime.
#
# Preview (branch/PR) NÃO migra: se o preview aponta pro mesmo banco de
# produção, uma migration de uma branch ainda não mergeada seria aplicada
# em produção.
set -e

if [ "$VERCEL_ENV" = "production" ]; then
  echo "[vercel-build] Aplicando migrations pendentes (prisma migrate deploy)..."
  npx prisma migrate deploy

  # Confere que o banco ficou mesmo em dia. Já aconteceu de o "deploy" passar
  # sem aplicar nada (conexão pelo pooler 6543 em vez da DIRECT_URL) e o
  # código novo subir sem as colunas. `migrate status` sai com erro se sobrou
  # migration pendente ou com falha — e aí o deploy para aqui, com o site
  # antigo ainda no ar.
  echo "[vercel-build] Conferindo se não sobrou migration pendente..."
  if ! npx prisma migrate status; then
    echo "[vercel-build] ERRO: o banco não está em dia com as migrations. Deploy interrompido." >&2
    exit 1
  fi
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-indefinido}: pulando migrations."
fi

npx next build
