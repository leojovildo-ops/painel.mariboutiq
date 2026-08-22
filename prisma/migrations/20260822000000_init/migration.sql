-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISORA', 'VENDEDORA');

-- CreateEnum
CREATE TYPE "StatsScope" AS ENUM ('STORE', 'SELLER');

-- CreateEnum
CREATE TYPE "GoalLevel" AS ENUM ('PRATA', 'OURO', 'DIAMANTE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VENDEDORA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "preview" JSONB NOT NULL,
    "sheetsFound" INTEGER NOT NULL DEFAULT 0,
    "sheetsIgnored" JSONB,
    "warnings" JSONB,
    "periodId" TEXT,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_stats" (
    "id" TEXT NOT NULL,
    "scope" "StatsScope" NOT NULL,
    "periodId" TEXT NOT NULL,
    "sellerId" TEXT,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "pa" DECIMAL(10,2),
    "tkm" DECIMAL(12,2),
    "salao" DECIMAL(12,2),
    "online" DECIMAL(12,2),
    "workingDays" INTEGER,
    "workedDays" INTEGER,
    "projection" DECIMAL(12,2),
    "editedAt" TIMESTAMP(3),
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "statsId" TEXT NOT NULL,
    "level" "GoalLevel" NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" TEXT NOT NULL,
    "statsId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2),
    "sales" INTEGER,
    "salao" DECIMAL(12,2),
    "online" DECIMAL(12,2),
    "pieces" INTEGER,

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_sellerId_key" ON "users"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_sheetName_key" ON "sellers"("sheetName");

-- CreateIndex
CREATE UNIQUE INDEX "periods_year_month_key" ON "periods"("year", "month");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "monthly_stats_periodId_idx" ON "monthly_stats"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_stats_periodId_sellerId_scope_key" ON "monthly_stats"("periodId", "sellerId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "goals_statsId_level_key" ON "goals"("statsId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_statsId_day_key" ON "daily_entries"("statsId", "day");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_stats" ADD CONSTRAINT "monthly_stats_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_stats" ADD CONSTRAINT "monthly_stats_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_stats" ADD CONSTRAINT "monthly_stats_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_statsId_fkey" FOREIGN KEY ("statsId") REFERENCES "monthly_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_statsId_fkey" FOREIGN KEY ("statsId") REFERENCES "monthly_stats"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No Postgres, NULLs sao distintos entre si: o unique (periodId, sellerId, scope)
-- nao impede duas linhas de loja no mesmo mes (sellerId NULL). Este indice parcial impede.
CREATE UNIQUE INDEX "monthly_stats_store_period_key" ON "monthly_stats"("periodId") WHERE "sellerId" IS NULL;

-- O app acessa o banco so via Prisma (dono das tabelas, que ignora RLS).
-- Habilitar RLS sem policy nenhuma fecha a API publica (anon/authenticated) do Supabase.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sellers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_entries" ENABLE ROW LEVEL SECURITY;
