/**
 * Monta uma planilha no layout descrito (inclusive #DIV/0!, abas de modelo e
 * planilha antiga sem SALÃO/ONLINE) e confere o que o leitor extrai.
 * Não faz parte do sistema — é a checagem do parser sem depender do arquivo real.
 */
import * as XLSX from "xlsx";
import { parseMonthWorkbook } from "../src/lib/xlsx/parseMonthWorkbook";

type Cell = { v: string | number; t?: "s" | "n" | "e" };

function aba(opts: {
  comCanais: boolean;
  dias: Array<[number, number, number]>; // faturamento, vendas, pecas
  metas: Array<[string, number]>;
  divZero?: boolean;
  projecao?: number;
}): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};
  const put = (addr: string, cell: Cell) =>
    (sheet[addr] = { t: cell.t ?? (typeof cell.v === "number" ? "n" : "s"), v: cell.v } as XLSX.CellObject);

  put("D2", { v: "dias úteis" });
  put("E2", { v: 26 });
  put("D3", { v: "dias trabalhados" });
  put("E3", { v: 20 });

  const cabecalho = opts.comCanais
    ? ["Data", "Faturamento", "Vendas", "SALÃO", "ONLINE", "Peças", "PA", "TM"]
    : ["Data", "Faturamento", "Vendas", "Peças", "PA", "TM"];
  cabecalho.forEach((label, i) => put(`${XLSX.utils.encode_col(3 + i)}7`, { v: label }));

  const colFat = "E";
  const colVen = "F";
  const colPec = opts.comCanais ? "I" : "G";
  const colSalao = "G";
  const colOnline = "H";

  let totFat = 0;
  let totVen = 0;
  let totPec = 0;
  opts.dias.forEach(([fat, ven, pec], i) => {
    const row = 8 + i;
    put(`D${row}`, { v: i + 1 });
    put(`${colFat}${row}`, { v: fat });
    put(`${colVen}${row}`, { v: ven });
    put(`${colPec}${row}`, { v: pec });
    if (opts.comCanais) {
      put(`${colSalao}${row}`, { v: fat * 0.8 });
      put(`${colOnline}${row}`, { v: fat * 0.2 });
    }
    totFat += fat;
    totVen += ven;
    totPec += pec;
  });

  put("D19", { v: "TOTAL" });
  put(`${colFat}19`, { v: totFat });
  put(`${colVen}19`, { v: totVen });
  put(`${colPec}19`, { v: totPec });

  put("D23", { v: "Total Mês" });
  put("E23", { v: totFat });
  put("D25", { v: "Projeção" });
  put("E25", { v: opts.projecao ?? totFat * 1.4 });

  opts.metas.forEach(([nivel, valor], i) => {
    const row = 23 + i;
    put(`I${row}`, { v: nivel });
    put(`J${row}`, { v: valor });
    put(`K${row}`, { v: totFat / valor });
  });

  if (opts.divZero) {
    put("K27", { v: "#DIV/0!", t: "e" });
    put("K28", { v: "#DIV/0!", t: "e" });
  } else {
    put("K27", { v: totVen ? totFat / totVen : 0 });
    put("K28", { v: totVen ? totPec / totVen : 0 });
  }

  sheet["!ref"] = "A1:L30";
  return sheet;
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  aba({ comCanais: true, dias: [[1000, 4, 8], [2000, 5, 11], [0, 0, 0]], metas: [["Prata", 2500], ["Ouro", 4000], ["Diamante", 6000]] }),
  "MAYARA"
);
// Planilha "antiga": sem SALÃO/ONLINE e com #DIV/0! nas médias.
XLSX.utils.book_append_sheet(
  wb,
  aba({ comCanais: false, dias: [[500, 2, 3], [0, 0, 0]], metas: [["Prata", 3000], ["Ouro", 5000]], divZero: true }),
  "STEFANY"
);
XLSX.utils.book_append_sheet(wb, aba({ comCanais: true, dias: [[0, 0, 0]], metas: [], divZero: true }), "RAFAELA");
XLSX.utils.book_append_sheet(
  wb,
  aba({ comCanais: true, dias: [[1500, 6, 11], [2000, 5, 11], [0, 0, 0]], metas: [["Prata", 30000], ["Ouro", 45000], ["Diamante", 60000]], projecao: 52000 }),
  "Mari Boutique"
);
// Abas de modelo, que devem ser ignoradas.
["LOJA", "VEND", "VEND 1", "vend 2"].forEach((nome) =>
  XLSX.utils.book_append_sheet(wb, aba({ comCanais: true, dias: [[99999, 1, 1]], metas: [] }), nome)
);

const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
const parsed = parseMonthWorkbook(buffer, "JULHO_2026.xlsx");

console.log("período:", parsed.year, parsed.month);
console.log("ignoradas:", parsed.ignoredSheets);
console.log("loja:", {
  revenue: parsed.store?.revenue,
  sales: parsed.store?.salesCount,
  pieces: parsed.store?.pieces,
  projecao: parsed.store?.projection,
  metas: parsed.store?.goals
});
for (const s of parsed.sellers) {
  console.log(s.sheetName, {
    revenue: s.revenue,
    sales: s.salesCount,
    pieces: s.pieces,
    pa: s.pa,
    tkm: s.tkm,
    salao: s.salao,
    online: s.online,
    diasUteis: s.workingDays,
    metas: s.goals.map((g) => `${g.level}:${g.target}`)
  });
}
console.log("avisos:", parsed.warnings);
