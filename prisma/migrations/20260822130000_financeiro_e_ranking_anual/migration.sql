-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('SALES', 'EXPENSES');

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "kind" "ImportKind" NOT NULL DEFAULT 'SALES';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "canViewFinance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "docType" TEXT,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "balance" DECIMAL(12,2),
    "sourceRow" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_months" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "grossRevenue" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_months_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_periodId_idx" ON "expenses"("periodId");

-- CreateIndex
CREATE INDEX "expenses_periodId_group_idx" ON "expenses"("periodId", "group");

-- CreateIndex
CREATE UNIQUE INDEX "finance_months_periodId_key" ON "finance_months"("periodId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_months" ADD CONSTRAINT "finance_months_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- As tabelas novas precisam dos mesmos direitos e da mesma policy do restante:
-- so o papel do app enxerga; anon/authenticated continuam sem policy nenhuma.
GRANT ALL PRIVILEGES ON TABLE "expenses" TO painel_app;
GRANT ALL PRIVILEGES ON TABLE "finance_months" TO painel_app;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_months" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painel_app_all ON "expenses";
DROP POLICY IF EXISTS painel_app_all ON "finance_months";
CREATE POLICY painel_app_all ON "expenses" FOR ALL TO painel_app USING (true) WITH CHECK (true);
CREATE POLICY painel_app_all ON "finance_months" FOR ALL TO painel_app USING (true) WITH CHECK (true);
