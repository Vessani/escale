-- Tabela interna de controle do Prisma também fica no schema public,
-- então também é alcançada pelo linter de segurança do Supabase.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
