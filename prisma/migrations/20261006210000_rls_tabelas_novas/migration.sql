-- Tabelas criadas depois de 20260707193000_enable_rls_all_tables sem RLS:
-- no Supabase ficavam abertas pela API REST pública (chave anon) — foi o
-- alerta de segurança do Supabase. O app usa o Prisma como dono das tabelas
-- (ignora RLS), então nada muda no funcionamento.
ALTER TABLE "ChegadaEntrega" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DespesaViagem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrocaMotorista" ENABLE ROW LEVEL SECURITY;

-- Segunda camada: o app não usa a API REST do Supabase (nem supabase-js,
-- Storage ou Realtime). Tira dos papéis anon/authenticated qualquer acesso
-- às tabelas do schema public, inclusive das que forem criadas daqui pra
-- frente — uma tabela nova esquecida sem RLS não fica exposta.
-- Só no Supabase (os papéis não existem num Postgres local).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
