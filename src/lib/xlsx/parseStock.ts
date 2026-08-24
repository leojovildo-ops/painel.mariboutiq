/**
 * Leitor do levantamento de estoque do SISloja.
 *
 * Duas abas interessam:
 *   "ESTOQUE SISLOJA" — um produto por linha: Código, Cód. Barras, Descrição,
 *                       Tam., Cor, Qtd, Unitário, Fornecedor, Categoria,
 *                       Status, Marca, Custo, À Vista
 *   "VENDAS"          — uma linha por item vendido: Data, Nº Pedido, Cliente,
 *                       Cód. Barras, Descrição, Qtd, Custo, Unitário, Total,
 *                       Vendedor
 *
 * As abas de análise que vêm no arquivo ("ANÁLISE BAIXA SAÍDA", "AÇÃO
 * PRIORITÁRIA") são ignoradas: o painel refaz essas contas a partir dos dados
 * crus, para não depender de uma fórmula que alguém pode alterar sem avisar.
 *
 * O nome do cliente NÃO é importado — o painel analisa produto, não pessoa.
 */
import * as XLSX from "xlsx";
import { normalize } from "./parseMonthWorkbook";

export interface ItemDeEstoque {
  barcode: string;
  code: string | null;
  description: string;
  size: string | null;
  color: string | null;
  quantity: number;
  price: number | null;
  cost: number | null;
  supplier: string | null;
  category: string | null;
  status: string | null;
  brand: string | null;
}

export interface VendaDeItem {
  date: string;
  orderNo: string | null;
  barcode: string;
  description: string;
  quantity: number;
  cost: number | null;
  unitPrice: number | null;
  total: number | null;
  sellerName: string | null;
}

export interface ParsedStock {
  itens: ItemDeEstoque[];
  vendas: VendaDeItem[];
  periodo: { de: string; ate: string } | null;
  warnings: string[];
}

type Linha = Record<string, unknown>;

function acharChave(linha: Linha, termos: string[]): string | null {
  const chaves = Object.keys(linha);
  for (const termo of termos) {
    const achou = chaves.find((k) => normalize(k).includes(termo));
    if (achou) return achou;
  }
  return null;
}

function texto(valor: unknown): string | null {
  if (valor == null || valor === "") return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

function numero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const n = Number(String(valor).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dataISO(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  const n = numero(valor);
  if (n != null && n > 20000 && n < 80000) {
    return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const t = texto(valor);
  if (!t) return null;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

export function parseStock(buffer: Buffer): ParsedStock {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  const abaEstoque = wb.SheetNames.find((n) => normalize(n).includes("ESTOQUE"));
  const abaVendas = wb.SheetNames.find((n) => normalize(n) === "VENDAS");

  const itens: ItemDeEstoque[] = [];
  const vendas: VendaDeItem[] = [];

  if (!abaEstoque) warnings.push('Não achei a aba de estoque ("ESTOQUE SISLOJA").');
  else {
    const linhas = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[abaEstoque], { defval: "" });
    if (linhas.length > 0) {
      const k = {
        barcode: acharChave(linhas[0], ["COD. BARRAS", "CODIGO DE BARRAS", "BARRAS"]),
        code: acharChave(linhas[0], ["CODIGO"]),
        description: acharChave(linhas[0], ["DESCRICAO"]),
        size: acharChave(linhas[0], ["TAM"]),
        color: acharChave(linhas[0], ["COR"]),
        quantity: acharChave(linhas[0], ["QTD", "QUANTIDADE"]),
        price: acharChave(linhas[0], ["UNITARIO"]),
        cost: acharChave(linhas[0], ["CUSTO"]),
        supplier: acharChave(linhas[0], ["FORNECEDOR"]),
        category: acharChave(linhas[0], ["CATEGORIA"]),
        status: acharChave(linhas[0], ["STATUS"]),
        brand: acharChave(linhas[0], ["MARCA"])
      };

      for (const linha of linhas) {
        const barcode = k.barcode ? texto(linha[k.barcode]) : null;
        const description = k.description ? texto(linha[k.description]) : null;
        if (!barcode || !description) continue;

        itens.push({
          barcode,
          code: k.code ? texto(linha[k.code]) : null,
          description,
          size: k.size ? texto(linha[k.size]) : null,
          color: k.color ? texto(linha[k.color]) : null,
          quantity: Math.round(k.quantity ? (numero(linha[k.quantity]) ?? 0) : 0),
          price: k.price ? numero(linha[k.price]) : null,
          cost: k.cost ? numero(linha[k.cost]) : null,
          supplier: k.supplier ? texto(linha[k.supplier]) : null,
          category: k.category ? texto(linha[k.category]) : null,
          status: k.status ? texto(linha[k.status]) : null,
          brand: k.brand ? texto(linha[k.brand]) : null
        });
      }
    }
  }

  if (!abaVendas) warnings.push('Não achei a aba "VENDAS" — sem ela não dá para calcular giro nem itens parados.');
  else {
    const linhas = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[abaVendas], { defval: "" });
    if (linhas.length > 0) {
      const k = {
        date: acharChave(linhas[0], ["DATA"]),
        orderNo: acharChave(linhas[0], ["PEDIDO"]),
        barcode: acharChave(linhas[0], ["COD. BARRAS", "BARRAS"]),
        description: acharChave(linhas[0], ["DESCRICAO"]),
        quantity: acharChave(linhas[0], ["QTD"]),
        cost: acharChave(linhas[0], ["CUSTO"]),
        unitPrice: acharChave(linhas[0], ["UNITARIO"]),
        total: acharChave(linhas[0], ["TOTAL"]),
        sellerName: acharChave(linhas[0], ["VENDEDOR"])
      };

      for (const linha of linhas) {
        const date = k.date ? dataISO(linha[k.date]) : null;
        const barcode = k.barcode ? texto(linha[k.barcode]) : null;
        if (!date || !barcode) continue;

        vendas.push({
          date,
          orderNo: k.orderNo ? texto(linha[k.orderNo]) : null,
          barcode,
          description: (k.description ? texto(linha[k.description]) : null) ?? "(sem descrição)",
          quantity: Math.round(k.quantity ? (numero(linha[k.quantity]) ?? 1) : 1),
          cost: k.cost ? numero(linha[k.cost]) : null,
          unitPrice: k.unitPrice ? numero(linha[k.unitPrice]) : null,
          total: k.total ? numero(linha[k.total]) : null,
          sellerName: k.sellerName ? texto(linha[k.sellerName]) : null
        });
      }
    }
  }

  const datas = vendas.map((v) => v.date).sort();
  const periodo = datas.length > 0 ? { de: datas[0], ate: datas[datas.length - 1] } : null;

  return { itens, vendas, periodo, warnings };
}
