import { prisma } from "@/lib/prisma";
import type { ItemDeEstoque, VendaDeItem } from "@/lib/xlsx/parseStock";

const LOTE = 500;

/**
 * Grava o estoque. Produtos e vendas são atualizados de forma independente,
 * porque chegam em arquivos diferentes: a foto do estoque ("Produtos") e o
 * relatório de vendas do período ("Exportação").
 *
 * Cada parte é substituída por completo quando chega: manter linhas antigas
 * junto com uma foto nova misturaria dois momentos e o "parado" deixaria de
 * fazer sentido.
 */
export async function applyStock(dados: {
  itens?: ItemDeEstoque[];
  vendas?: VendaDeItem[];
  periodo?: { de: string; ate: string } | null;
  fileName: string;
}) {
  if (dados.itens) {
    await prisma.stockItem.deleteMany({});
    for (let i = 0; i < dados.itens.length; i += LOTE) {
      await prisma.stockItem.createMany({
        data: dados.itens.slice(i, i + LOTE).map((item) => ({
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
  }

  if (dados.vendas) {
    await prisma.stockSale.deleteMany({});
    for (let i = 0; i < dados.vendas.length; i += LOTE) {
      await prisma.stockSale.createMany({
        data: dados.vendas.slice(i, i + LOTE).map((venda) => ({
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
  }

  // O resumo guarda o que existe agora no banco, e não só o que veio no arquivo.
  const anterior = await prisma.stockSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  const itemCount = await prisma.stockItem.count();
  const saleCount = await prisma.stockSale.count();
  const periodo = dados.vendas
    ? dados.periodo
    : anterior?.salesFrom && anterior.salesTo
      ? { de: anterior.salesFrom.toISOString().slice(0, 10), ate: anterior.salesTo.toISOString().slice(0, 10) }
      : null;

  await prisma.stockSnapshot.deleteMany({});
  await prisma.stockSnapshot.create({
    data: {
      fileName: dados.fileName,
      itemCount,
      saleCount,
      salesFrom: periodo ? new Date(`${periodo.de}T00:00:00Z`) : null,
      salesTo: periodo ? new Date(`${periodo.ate}T00:00:00Z`) : null
    }
  });

  return { itens: itemCount, vendas: saleCount, periodo };
}
