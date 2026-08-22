-- Outras grafias pelas quais a vendedora aparece na pesquisa.
ALTER TABLE "sellers" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
