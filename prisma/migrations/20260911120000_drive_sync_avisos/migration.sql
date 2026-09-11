-- Avisos da importacao automatica, para o painel notificar quem administra.
ALTER TABLE "drive_syncs" ADD COLUMN "warnings" JSONB;
ALTER TABLE "drive_syncs" ADD COLUMN "seenAt" TIMESTAMP(3);
