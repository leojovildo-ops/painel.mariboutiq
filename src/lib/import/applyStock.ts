import { prisma } from "@/lib/prisma";
import type { ParsedStock } from "@/lib/xlsx/parseStock";

/**
 * Grava o levantamento de estoque.
 *
 * O estoque é uma foto de um momento e as vendas são o período inteiro, então
 * os dois são substituídos por completo a cada importação: manter linhas
 * antigas misturaria duas fotos e o "parado" deixaria de fazer sentido.
 */
export async function applyStock(parsed: ParsedStock, fileName: string) {
  await prisma.stockItem.deleteMany({});
  await prisma.stockSale.deleteMany({});

  const LOTE = 500;

  for (let i = 0; i < parsed.itens.length; i += LOTE) {
    await prisma.stockItem.createMany({
      data: parsed.itens.slice(i, i + LOTE).map((item) => ({
        barcode: item.barcode,
        code: item.code,
        description: item.description,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost,
        supplier: item.supplier,
        category: item.category,
        status: item.status,
        brand: item.brand
      })),
      skipDuplicates: true
    });
  }

  for (let i = 0; i < parsed.vendas.length; i += LOTE) {
    await prisma.stockSale.createMany({
      data: parsed.vendas.slice(i, i + LOTE).map((venda) => ({
        date: new Date(`${venda.date}T00:00:00Z`),
        orderNo: venda.orderNo,
        barcode: venda.barcode,
        description: venda.description,
        quantity: venda.quantity,
        cost: venda.cost,
        unitPrice: venda.unitPrice,
        total: venda.total,
        sellerName: venda.sellerName
      }))
    });
  }

  await prisma.stockSnapshot.deleteMany({});
  await prisma.stockSnapshot.create({
    data: {
      fileName,
      itemCount: parsed.itens.length,
      saleCount: parsed.vendas.length,
      salesFrom: parsed.periodo ? new Date(`${parsed.periodo.de}T00:00:00Z`) : null,
      salesTo: parsed.periodo ? new Date(`${parsed.periodo.ate}T00:00:00Z`) : null
    }
  });

  return { itens: parsed.itens.length, vendas: parsed.vendas.length, periodo: parsed.periodo };
}
