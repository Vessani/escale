# Escalador

Sistema de gestão de viagens e alocação de motoristas para uma transportadora, com autenticação por filial e sugestão automática de motorista compatível com cada viagem.

## O que o sistema faz

- Cadastro de viagens, motoristas, frotas (conjuntos cavalo/carreta) e clientes, isolados por filial.
- Alocação automática de motorista por viagem, considerando turno, integração ativa exigida pelo cliente, jornada (limite de 6 dias consecutivos de trabalho) e descanso mínimo entre viagens (interjornada de 11h, ou 35h após o 6º dia consecutivo).
- Aviso de conflito quando duas viagens sobrepostas (ou muito próximas) seriam atribuídas ao mesmo motorista.
- Importação de viagens via planilha .xlsx/.xls, uma de cada vez ou em lote com revisão de alocação antes de confirmar.
- Calendário operacional de motoristas (jornada projetada dia a dia, folga/férias/exames/interno).
- Controle de disponibilidade de frota (cavalo/carreta), recalculada a partir das viagens ativas do conjunto.
- Exportação de viagem em PDF e dashboard de acompanhamento por status.

## Decisões de arquitetura

**Server actions como única porta de mutação.** Toda escrita passa por `lib/actions/*.ts`, que valida a sessão, valida o payload com Zod e delega para `lib/services/*.ts`. Não há rotas REST para as operações principais — as poucas rotas em `app/api/` existem só onde o Next não permite server action (autenticação via NextAuth, exportação de PDF).

**Regra de negócio isolada em `lib/services`.** Cálculo de compatibilidade de motorista, descanso mínimo, disponibilidade de frota e projeção de jornada vivem em funções puras ou quase-puras, independentes de Next.js/Prisma quando possível — o que permite testá-las diretamente, sem mockar HTTP ou banco. `lib/actions` não contém lógica de negócio, só orquestração e autorização; `lib/queries` concentra as leituras.

**Soft delete com unicidade parcial.** Viagens e frotas não são apagadas de fato (`deletadoEm`), mas o número da viagem (`numViagem`) precisa ser único apenas entre registros ativos da mesma filial — um índice único parcial (criado à mão na migration, não representável só com `@@unique` do Prisma) garante isso sem impedir reaproveitar um número depois de uma viagem excluída, nem colidir entre filiais diferentes.

**Isolamento multi-filial em duas camadas.** Toda tabela operacional tem `filialId`, e toda query/mutação recebe esse valor a partir da sessão autenticada — nunca do cliente. Como camada adicional, Row Level Security do Postgres está habilitado nas tabelas, reduzindo o custo de um erro de escopo esquecido em alguma query.

**Interjornada calculada contra o histórico real, não um agregado.** O aviso de descanso insuficiente busca o último registro de jornada real anterior ao início da viagem sendo avaliada (`RegistroJornada`), em vez de um campo `jornadaRelatorioFim` fixo no motorista — que representava só "a jornada mais recente do último lote importado" e podia, em alguns casos, ser posterior à própria viagem sendo avaliada.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL, com Row Level Security
- **ORM:** Prisma
- **Autenticação:** NextAuth.js
- **UI:** Tailwind CSS + Radix UI
- **Formulários:** React Hook Form + Zod
- **Testes:** Vitest

## Instalação

```bash
npm install
cp .env.example .env.local   # configurar DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
npx prisma migrate deploy
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run lint
npm run build
npm run start
```

Instruções de deployment em [DEPLOYMENT.md](./DEPLOYMENT.md).

## Estrutura do projeto

```
escala/
├── app/
│   ├── motorista/        # listagem, calendário de jornada, criar/editar
│   ├── viagens/           # listagem, criar (com import .xlsx), editar, alocação manual
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   └── viagens/[id]/pdf/
│   └── layout.tsx
├── lib/
│   ├── actions/           # server actions — única porta de entrada para mutações
│   ├── queries/            # leituras direto do Prisma
│   ├── services/           # regras de negócio (*.service.ts)
│   ├── parsers/             # parser de planilha .xlsx/.xls
│   ├── validation/          # schemas Zod
│   ├── types/                # tipos compartilhados (input/output de actions)
│   └── utils/                 # utilitários puros (ex: formatação de data)
├── components/
│   ├── ui/                # primitivos shadcn/radix
│   ├── layout/             # shell da aplicação
│   ├── motorista/           # formulário compartilhado criar/editar motorista
│   └── viagem/                # upload .xlsx, campos de rota e entregas
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── proxy.ts                # middleware de autenticação
```

Fluxo de dados: página/componente → `lib/actions` (server action) → `lib/services` (regra de negócio) → Prisma. Leituras usam `lib/queries` diretamente, sem passar por `lib/actions`.

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://user:password@localhost:5432/escala?schema=public"
NEXTAUTH_SECRET="gere-uma-chave-aleatoria-com-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"
```

Nunca commitar `.env`. Para gerar `NEXTAUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testes

```bash
npm run test
```

## Rotas HTTP e server actions

A maior parte das operações (criar/editar/excluir viagem e motorista, alocar motorista, atualizar status/jornada, importar em lote) não é REST — são [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) do Next.js, chamadas diretamente pelos componentes client a partir de `lib/actions/viagens.ts` e `lib/actions/motoristas.ts`.

Rotas HTTP reais (`app/api/`):
- `GET|POST /api/auth/[...nextauth]` — autenticação (NextAuth)
- `GET /api/viagens/[id]/pdf` — exporta uma viagem em PDF

Páginas (`app/`):
- `/login`, `/motorista`, `/motorista/novo`, `/motorista/editar/[id]`
- `/viagens`, `/viagens/nova`, `/viagens/editar/[id]`, `/viagens/alocacao`

## Licença

Proprietary — Transportadora Digital
