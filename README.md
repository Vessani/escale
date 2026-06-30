# 🚀 Transportadora Digital - Escala

Sistema de gestão de viagens e alocação de motoristas com autenticação e dashboard interativo.

## ✨ Funcionalidades

- ✅ Autenticação segura com NextAuth
- ✅ Gestão completa de viagens (criar, editar, listar)
- ✅ Gestão de motoristas com integrações
- ✅ Visualização de datas de validade de integrações
- ✅ Alocação automática por turno + integração + jornada (até 6 dias consecutivos)
- ✅ Priorização automática do motorista com maior disponibilidade
- ✅ Edição manual de alocação para cenários de emergência
- ✅ Visão de viagens por status (aguardando início, em andamento, finalizada, cancelada)
- ✅ Calendário operacional de motoristas (motoristas nas colunas e dias nas linhas)
- ✅ Interface responsiva e moderna (Tailwind CSS)
- ✅ Validação de dados (Zod)
- ✅ Banco de dados relacional (Prisma + PostgreSQL)

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
│   │   ├── page.tsx (listar motoristas)
│   │   ├── novo/ (criar motorista)
│   │   └── editar/[id]/ (editar motorista)
│   ├── viagens/
│   │   ├── page.tsx (listar viagens)
│   │   ├── nova/ (criar viagem)
│   │   ├── editar/[id]/ (editar viagem)
│   │   └── alocacao/ (alocação manual)
│   ├── api/auth/[...nextauth]/ (autenticação)
│   └── layout.tsx
├── lib/
│   ├── actions/ (server actions)
│   ├── queries/ (database queries)
│   ├── services/ (business logic)
│   ├── validation/ (schemas Zod)
│   └── types/ (TypeScript types)
├── components/ (UI components)
├── prisma/
│   └── schema.prisma (data models)
└── proxy.ts (middleware autenticação)
```

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
# Rodar testes unitários
npm run test

# Com cobertura
npm run test:coverage
```

## 📋 API Routes

### Autenticação
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Info sessão

### Viagens
- `GET /viagens` - Listar viagens
- `POST /viagens` - Criar viagem
- `PUT /viagens/[id]` - Editar viagem
- `DELETE /viagens/[id]` - Deletar viagem

### Motoristas
- `GET /motorista` - Listar motoristas
- `POST /motorista` - Criar motorista
- `PUT /motorista/[id]` - Editar motorista
- `DELETE /motorista/[id]` - Deletar motorista

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
**Última atualização:** 2026-06-28
