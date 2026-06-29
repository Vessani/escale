# 📦 Guia de Deployment - Transportadora Digital Escala

## Visão Geral

Sistema Next.js para gestão de viagens e motoristas com:
- Autenticação via NextAuth
- Banco de dados PostgreSQL
- Gestão de motoristas com integrações e validades
- Alocação dinâmica de viagens

---

## 🔧 Pré-requisitos

- **Node.js** 18+ ou 20+
- **PostgreSQL** 12+
- **npm** ou **yarn**
- Acesso a servidor para deployment (Vercel, AWS, Digital Ocean, etc)

---

## 📋 Preparação para Deployment

### 1️⃣ Configurar Variáveis de Ambiente

**Gerar segredo do NextAuth:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Criar `.env.production.local` (em produção):**
```env
DATABASE_URL="postgresql://user:password@host:port/escala?schema=public"
NEXTAUTH_SECRET="<sua-chave-gerada-acima>"
NEXTAUTH_URL="https://seu-dominio.com"
```

⚠️ **NUNCA** commitar `.env` no Git!

---

### 2️⃣ Preparar Banco de Dados

**Em desenvolvimento (local):**
```bash
# Instalar dependências
npm install

# Aplicar migrações do Prisma
npx prisma migrate deploy

# Gerar cliente Prisma
npx prisma generate
```

**Em produção (servidor remoto):**
```bash
# Conectar ao PostgreSQL remoto
# DATABASE_URL apontando para servidor de produção

# Aplicar migrações (executa uma única vez)
npx prisma migrate deploy

# Seed inicial (opcional - popular dados)
npx prisma db seed
```

---

### 3️⃣ Build para Produção

```bash
# Fazer build otimizado
npm run build

# Testar build localmente
npm run start

# Validar lint/type-checking
npm run lint
```

---

## 🚀 Opções de Deployment

### **Opção 1: Vercel (Recomendado para Next.js)**

1. **Conectar repositório:**
   - Push do código para GitHub/GitLab
   - Conectar Vercel ao repositório

2. **Configurar variáveis:**
   - No dashboard Vercel → Settings → Environment Variables
   - Adicionar `DATABASE_URL` e `NEXTAUTH_SECRET`

3. **Deploy automático:**
   ```bash
   git push origin main
   # Vercel faz deploy automaticamente
   ```

### **Opção 2: AWS EC2 / Digital Ocean / Linode**

```bash
# SSH para servidor
ssh user@seu-servidor.com

# Clonar repositório
git clone <seu-repo> /var/www/escala
cd /var/www/escala

# Instalar dependências
npm install --production

# Build
npm run build

# Usar PM2 para manter rodando
npm install -g pm2
pm2 start "npm run start" --name escala
pm2 startup
pm2 save
```

### **Opção 3: Docker**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Deploy com Docker:
```bash
docker build -t escala .
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  escala
```

---

## ✅ Checklist Final de Deployment

- [ ] `.env` **NÃO** está em git (verificar `.gitignore`)
- [ ] `DATABASE_URL` apontando para BD produção
- [ ] `NEXTAUTH_SECRET` é uma string aleatória de 32+ chars
- [ ] `NEXTAUTH_URL` configurada com domínio correto
- [ ] Build local passou (`npm run build`)
- [ ] Lint passou (`npm run lint`)
- [ ] Migrações do Prisma aplicadas
- [ ] Banco de dados acessível do servidor
- [ ] HTTPS configurado (essencial para NextAuth)
- [ ] Logs monitorados pós-deploy

---

## 🔐 Segurança em Produção

1. **HTTPS Obrigatório**
   - NextAuth requer HTTPS em produção
   - Configurar certificado SSL/TLS

2. **Senhas de Banco**
   - Usar credenciais fortes
   - Armazenar em secrets manager (AWS Secrets, Vercel, etc)

3. **Backups**
   - Configurar backups automáticos do PostgreSQL
   - Testar restore regularmente

4. **Monitoramento**
   - Monitorar logs e performance
   - Configurar alertas para erros críticos

---

## 📞 Troubleshooting

| Erro | Solução |
|------|---------|
| `DATABASE_URL is not set` | Verificar `.env` e variáveis no servidor |
| `NEXTAUTH_SECRET is not set` | Gerar e adicionar segredo |
| `Proxy protocol invalid` | Certificar que HTTPS está ativo |
| `Connection refused` | Verificar acesso ao PostgreSQL |
| `Build failed` | Rodar `npm run build` localmente para debug |

---

## 📚 Recursos

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NextAuth.js Deployment](https://next-auth.js.org/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/orm/prisma-client/deployment)
- [Vercel Docs](https://vercel.com/docs)

---

**Última atualização:** 2026-06-28  
**Versão:** 0.1.0
