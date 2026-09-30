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
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-indefinido}: pulando migrations."
fi

npx next build
