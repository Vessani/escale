# 🚀 Transportadora Digital - Escala

Sistema de gestão de viagens e alocação de motoristas com autenticação e dashboard interativo.

## ✨ Funcionalidades

- ✅ Autenticação segura com NextAuth
- ✅ Gestão completa de viagens (criar, editar, listar)
- ✅ Gestão de motoristas com integrações
- ✅ Visualização de datas de validade de integrações
- ✅ Importação de viagens via planilha .xlsx/.xls (uma viagem ou várias de uma vez)
- ✅ Importação em lote: cria todas as viagens do arquivo direto e leva para a alocação
- ✅ Alocação automática por turno + integração + jornada (até 6 dias consecutivos)
- ✅ Priorização automática do motorista com maior disponibilidade
- ✅ Aviso de conflito quando o mesmo motorista é escolhido para viagens com período sobreposto
- ✅ Edição manual de alocação para cenários de emergência
- ✅ Visão de viagens por status (aguardando início, em andamento, finalizada, cancelada)
- ✅ Calendário operacional de motoristas (motoristas nas colunas e dias nas linhas)
- ✅ Interface responsiva e moderna (Tailwind CSS)
- ✅ Validação de dados (Zod)
- ✅ Banco de dados relacional (Prisma + PostgreSQL, com Row Level Security habilitado)

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16.2.9
- **Runtime:** Node.js 18+
- **Linguagem:** TypeScript
- **Banco de Dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** NextAuth.js
- **UI:** Tailwind CSS + Radix UI
- **Forms:** React Hook Form + Zod
- **Icons:** Phosphor Icons + Lucide React

## 📦 Instalação & Desenvolvimento

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco de dados
# Criar arquivo .env.local baseado em .env.example
cp .env.example .env.local

# 3. Aplicar migrações
npx prisma migrate deploy

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 🚀 Build & Deploy

```bash
# Validar código
npm run lint

# Criar build otimizado
npm run build

# Testar em produção localmente
npm run start
```

Para instruções detalhadas de deployment, veja [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📁 Estrutura do Projeto

```
escala/
├── app/
│   ├── motorista/
│   │   ├── page.tsx (listar + calendário de jornada)
│   │   ├── jornada-status.ts (cores/labels do status de jornada)
│   │   ├── novo/ (criar motorista)
│   │   └── editar/[id]/ (editar motorista)
│   ├── viagens/
│   │   ├── page.tsx (listar viagens)
│   │   ├── nova/ (criar viagem, com import .xlsx único e em lote)
│   │   ├── editar/[id]/ (editar viagem)
│   │   └── alocacao/ (alocação manual + aviso de conflito de motorista)
│   ├── api/
│   │   ├── auth/[...nextauth]/ (autenticação)
│   │   └── viagens/[id]/pdf/ (exportação de viagem em PDF)
│   └── layout.tsx
├── lib/
│   ├── actions/ (server actions — única porta de entrada para mutações)
│   ├── queries/ (leituras direto do Prisma)
│   ├── services/ (regras de negócio, *.service.ts)
│   ├── parsers/ (parser de planilha .xlsx/.xls)
│   ├── validation/ (schemas Zod)
│   ├── types/ (tipos compartilhados — Input/Output de actions, respostas)
│   └── utils/ (utilitários puros, ex: formatação de data)
├── components/
│   ├── ui/ (primitivos shadcn/radix)
│   ├── layout/ (shell da aplicação)
│   ├── motorista/ (formulário compartilhado criar/editar motorista)
│   └── viagem/ (upload .xlsx, campos de rota e de entregas do formulário de viagem)
├── prisma/
│   ├── schema.prisma (data models)
│   └── migrations/
└── proxy.ts (middleware autenticação)
```

**Padrão de fluxo de dados:** página/componente → `lib/actions` (server action) → `lib/services` (regra de negócio) → Prisma. Leituras usam `lib/queries` diretamente. Tipos de entrada/saída de actions ficam em `lib/types/types.ts`; tipos específicos de uma tela (view-model de props) ficam no próprio arquivo do componente.

## 🔐 Configuração de Ambiente

Criar arquivo `.env.local`:

```env
# Banco de dados
DATABASE_URL="postgresql://user:password@localhost:5432/escala?schema=public"

# NextAuth
NEXTAUTH_SECRET="gere-uma-chave-aleatoria-com-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"
```

⚠️ **NUNCA** commitar `.env` no Git!

Para gerar `NEXTAUTH_SECRET` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🧪 Testes

```bash
npm run test
```

## 📋 Rotas HTTP e Server Actions

A maior parte das operações (criar/editar/excluir viagem e motorista, alocar motorista, atualizar status/jornada, importar em lote) **não é REST** — são [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) do Next.js, chamadas diretamente pelos componentes client a partir de `lib/actions/viagens.ts` e `lib/actions/motoristas.ts`.

Rotas HTTP reais (`app/api/`):
- `GET|POST /api/auth/[...nextauth]` - Autenticação (NextAuth)
- `GET /api/viagens/[id]/pdf` - Exporta uma viagem em PDF

Páginas (`app/`):
- `/login`, `/motorista`, `/motorista/novo`, `/motorista/editar/[id]`
- `/viagens`, `/viagens/nova`, `/viagens/editar/[id]`, `/viagens/alocacao`

## 🐛 Debug

Ativar logs detalhados:

```env
DEBUG=prisma:client
DEBUG=next-auth:*
```

## 📞 Suporte

Para problemas:
1. Verificar [DEPLOYMENT.md](./DEPLOYMENT.md) → Troubleshooting
2. Revisar logs do servidor
3. Validar `.env` e database connection

## 📄 Licença

Proprietary - Transportadora Digital

---

**Versão:** 0.1.0  
**Última atualização:** 2026-07-07
