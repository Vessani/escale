# Escalador

Sistema de escala de viagens da Ritmo Logística: programação das viagens de gases (CO₂, nitrogênio, argônio, oxigênio e biometano), alocação de motorista e frota, acompanhamento da viagem pelo próprio motorista e relatórios operacionais. Tudo separado por filial.

## O que o sistema faz

**Operação (escalador)**
- **Dashboard** do dia: viagens por status, motoristas livres, quadro de recados da filial e viagens de outros dias que continuam em aberto ("Desde 01/10", "Não saiu (03/10)").
- **Viagens**: cadastro manual ou importação de planilha (.xlsx/.xls), uma a uma ou em lote, com revisão da alocação sugerida antes de confirmar.
- **Alocação de motorista** com sugestão automática. O seletor mostra cada motorista em cores, com o motivo ao lado:
  - verde: cabe na regra e na agenda ("3 dias disponíveis");
  - laranja: cabe na regra, mas tem viagem ou descanso no caminho;
  - branco/vermelho: fora da regra (turno, produto não autorizado, integração do cliente, folga ou 7º dia).
- **Correção do que o motorista registrou**: km, pedágio/pernoite e chegadas nos clientes, inclusive com a viagem encerrada. Toda correção fica no histórico.
- **Motoristas**: cadastro, calendário de jornada (trabalho, folga, férias, exames, interno, manutenção) e importação do relatório de jornada do ponto, com conferência antes de gravar.
- **Frotas** (cavalo + carreta) com disponibilidade calculada pelas viagens ativas e registro de manutenções.
- **Clientes**: SAP code, número white, cidade, fator do tanque e integrações exigidas.

**Motorista** (login com matrícula + PIN, área `/minhas-viagens`)
- Vê só as próprias viagens, registra saída, km, pedágio/pernoite e a chegada em cada cliente com a medição da descarga:
  - manômetro: (final − inicial) × fator do cliente;
  - balança: (inicial − final) × fator da balança;
  - biometano: m³ inicial − m³ final.
- Baixa o relatório da viagem.

**Relatórios** (`/relatorios`, com exportação Excel)
- **Viagens:** relatório linear, uma linha por viagem.
- **Km e custos:** por viagem e por motorista.
- **Pontualidade.**
- **Jornada:** estouro de jornada, estouro do 7º dia, quebra de interstício, circadiano.
- **Cadastros e operação:** motoristas, frota, integrações, avisos.

Só contam como entrega de cliente as paradas com **SAP code e número white** preenchidos; a origem (ex.: Joinville) não entra.

**Gerência**: o Admin vê o histórico de alterações (quem mudou o quê); o Superadmin cadastra filiais e usuários.

## Regras de escala

| Regra | Valor | Onde |
|---|---|---|
| Dias seguidos de trabalho antes da folga | 6 | `lib/services/dias-sem-folga.ts` |
| Descanso mínimo entre jornadas (interjornada) | 11 h | `lib/services/alocacao/disponibilidade.ts` |
| Descanso que caracteriza folga | 35 h | `lib/services/alocacao/disponibilidade.ts` |
| Jornada prevista (estouro) | 12 h | `lib/services/relatorios/jornada-analise.ts` |
| Turno pelo horário de início | Dia 04:00–15:59 · Noite 16:00–03:59 | `lib/services/turno.ts` |

## Papéis

| Papel | Acesso |
|---|---|
| `SUPERADMIN` | Cadastro de filiais e usuários; sem tela operacional (não pertence a uma filial) |
| `ADMIN` | Tudo da filial + gerência (histórico de alterações) |
| `DESPACHANTE` | Operação da filial: viagens, alocação, motoristas, frotas, clientes, relatórios |
| `MOTORISTA` | Só `/minhas-viagens`, com as viagens dele |

## Arquitetura

```
página / componente
   │  leitura ───────────────► lib/queries ──► Prisma
   │  escrita
   ▼
lib/actions (server action) ─► lib/services (regra de negócio) ─► Prisma (transação)
   sessão + filial, Zod           funções testáveis,               + RegistroAuditoria
                                  trava de linha (FOR UPDATE)
```

- **Server actions são a porta de escrita.** Nenhuma action fala com o Prisma direto. Cada action:
  - valida a sessão e a filial (`requireSessionComFilial` / `requireSessaoMotorista`);
  - valida o payload com Zod e chama um service;
  - devolve `RespostaAcao` (`{ sucesso, erro }`).

  Os erros passam por `errorToMessage`, que traduz erro de validação, de domínio (`ErroDeDominio`) e do Prisma, e só registra no log o que é inesperado.
- **Regra de negócio em `lib/services`**, em funções puras sempre que possível: compatibilidade, disponibilidade, jornada, descarga e relatórios. É a parte com mais testes.
- **Multi-filial em duas camadas.** `filialId` vem sempre da sessão, nunca do cliente. Além disso, o Postgres tem Row Level Security nas tabelas operacionais.
- **Concorrência**: escritas que dependem do estado atual (status, saída, exclusão e correções da viagem; manutenções; clientes; ativar/desativar usuário) leem e travam a linha com `SELECT … FOR UPDATE` dentro da própria transação. Assim o "antes" da auditoria é sempre o estado que de fato mudou.
- **Auditoria**: toda criação, alteração ou exclusão grava antes/depois em `RegistroAuditoria` (`registrarAuditoria`), com um campo `_contexto` legível ("Correção do escalador (viagem 922087) · km").
- **Soft delete** (`deletadoEm`). Um índice único parcial garante `numViagem` único só entre as viagens ativas da mesma filial.
- **Fuso horário**: tudo é calculado em horário de Brasília com offset fixo (UTC−3), independente do fuso do servidor. Os helpers ficam em `lib/utils/date-format.ts`, e os testes rodam em UTC e em `America/Sao_Paulo`.
- **Segurança**:
  - headers de segurança em `next.config.ts`;
  - rate limit de login (usuário e PIN do motorista);
  - PIN guardado só como hash;
  - nenhuma SQL montada com texto do usuário (`$queryRaw` com template).

## Stack

Next.js 16 (App Router, server actions) · TypeScript · PostgreSQL (Supabase) com RLS · Prisma 7 · NextAuth (JWT) · Tailwind CSS + Radix UI · React Hook Form + Zod · ExcelJS · Vitest · Vercel.

## Estrutura

```
app/
├── page.tsx                 # dashboard
├── viagens/                 # lista, nova (manual/planilha), editar/[id], alocacao, relatorio
├── motorista/               # lista, calendário, importar-jornada, sem-viagem
├── minhas-viagens/          # área do motorista
├── frotas/                  # frotas + manutencoes
├── clientes/
├── relatorios/              # avisos, circadiano, estouro-7-dia, estouro-jornada, frota,
│                            # integracoes, km-custos, motoristas, pontualidade,
│                            # quebra-intersticio, viagens
├── historico/               # auditoria (gerência)
├── admin/                   # filiais, usuarios (gerência)
├── login/
└── api/                     # só o que não pode ser server action (ver abaixo)
lib/
├── actions/                 # server actions — porta de escrita
├── services/                # regras de negócio (+ alocacao/, relatorios/)
├── queries/                 # leituras
├── validation/              # schemas Zod
├── parsers/                 # planilha de viagens, relatório de jornada
├── excel/, relatorios/      # leitura/geração de planilhas e catálogo de relatórios
├── utils/                   # datas, dinheiro, km, texto — sem dependências de servidor
└── auth.ts, auth-guard.ts, papeis.ts, action-error.ts, chamar-acao.ts
components/                  # ui/ (primitivos), layout/, viagem/, motorista/, frota/, relatorio/…
prisma/                      # schema.prisma + migrations/
proxy.ts                     # proteção de rotas por sessão e papel
```

### Rotas HTTP (`app/api/`)

| Rota | Uso |
|---|---|
| `/api/auth/[...nextauth]` | Login (NextAuth) |
| `GET /api/viagens`, `GET /api/viagens/[id]` | Consulta de viagens |
| `GET /api/viagens/[id]/relatorio` | Relatório da viagem (motorista/escalador) |
| `GET /api/viagens/[id]/excel` | Viagem em Excel |
| `GET /api/motoristas` | Consulta de motoristas |
| `GET /api/relatorios/exportar/[tipo]` | Exportação Excel de cada relatório |
| `GET /api/relatorios/programacao` | Programação do período em Excel |

## Rodando localmente

```bash
npm install                    # roda prisma generate no postinstall
cp .env.example .env.local     # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, TZ
npx prisma migrate deploy
npm run dev                    # http://localhost:3000
```

`.env.example` explica cada variável. `DIRECT_URL` só é necessária quando o `DATABASE_URL` passa por pooler em modo transação (Supabase, porta 6543). Para gerar o `NEXTAUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run vercel-build` | Build da Vercel: em produção aplica as migrations (`scripts/vercel-build.sh`) |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier (sem ponto e vírgula, aspas duplas, 140 colunas) |
| `npm test` | Testes em UTC (como na Vercel) |
| `npm run test:br` | Testes em horário de Brasília |
| `npm run knip` | Procura arquivos, exports e dependências sem uso |

O CI (`.github/workflows/ci.yml`) roda tipos, lint, formatação, knip e as duas suítes de teste em todo PR.

## Deploy

Vercel, com o banco no Supabase. Cada merge na `main` publica. Detalhes em [DEPLOYMENT.md](./DEPLOYMENT.md) e [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md).

## Licença

Proprietário — Ritmo Logística.
