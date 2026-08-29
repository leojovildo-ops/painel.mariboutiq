-- Controle do robo que importa as planilhas do Drive sozinho.
CREATE TABLE "drive_syncs" (
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "modifiedTime" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "detail" TEXT,

    CONSTRAINT "drive_syncs_pkey" PRIMARY KEY ("fileId")
);
