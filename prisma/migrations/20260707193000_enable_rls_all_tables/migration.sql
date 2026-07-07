-- Habilita Row Level Security em todas as tabelas do schema public.
-- Sem essa flag, o Supabase expõe as tabelas via API REST pública (anon key)
-- para qualquer pessoa com a URL do projeto, ignorando toda a autenticação
-- da aplicação. O app conecta via Prisma como dono das tabelas, que ignora
-- RLS por padrão, então esta mudança não afeta o funcionamento do sistema.
ALTER TABLE "Viagem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entrega" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Motorista" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integracao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
