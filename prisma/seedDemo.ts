/**
 * Popula o ambiente de DEMONSTRAÇÃO com dados fictícios.
 *
 * Roda contra o schema `demo`, nunca contra o de produção — o script recusa
 * rodar se a URL não apontar para lá, porque um engano aqui apagaria os dados
 * reais da loja.
 *
 * Os números são inventados, mas com a forma dos de verdade: sazonalidade de
 * varejo de moda (dezembro forte, janeiro fraco), metas por vendedora, meses
 * em que alguém não bate a meta, despesa maior que faturamento em um mês.
 * Demonstração com números perfeitos não convence ninguém e não mostra os
 * alertas do sistema funcionando.
 *
 *   npm run seed:demo
 */
import { PrismaClient, type GoalLevel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ANO = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const VENDEDORAS = [
  { sheetName: "ANA", name: "Ana Beatriz", forca: 1.15 },
  { sheetName: "CAMILA", name: "Camila Rocha", forca: 1.0 },
  { sheetName: "JULIA", name: "Júlia Mendes", forca: 0.82 },
  { sheetName: "LARISSA", name: "Larissa Prado", forca: 0.7, entraNoMes: 5 }
];

/** Peso de cada mês no varejo de moda: dezembro explode, janeiro esvazia. */
const SAZONALIDADE = [0.72, 0.88, 0.95, 1.0, 1.12, 1.05, 0.98, 1.02, 1.0, 1.08, 1.2, 1.85];

const GRUPOS = [
  { nome: "FORNECEDOR", fatia: 0.42 },
  { nome: "DESPESAS FUNCIONÁRIOS", fatia: 0.18 },
  { nome: "IMPOSTOS", fatia: 0.11 },
  { nome: "CUSTOS FIXOS", fatia: 0.09 },
  { nome: "CUSTOS VARIÁVEIS", fatia: 0.07 },
  { nome: "DESPESAS PESSOAL DOS SÓCIOS", fatia: 0.08 }
];

const PRODUTOS = [
  ["VESTIDO MIDI FLORAL", "VESTIDOS", 89, 249.9],
  ["CALÇA WIDE LEG", "CALÇAS", 62, 189.9],
  ["BLUSA DE TRICÔ", "BLUSAS", 38, 129.9],
  ["CROPPED CANELADO", "BLUSAS", 19, 69.9],
  ["CONJUNTO ALFAIATARIA", "CONJUNTOS", 118, 329.9],
  ["SAIA PLISSADA", "SAIAS", 44, 149.9],
  ["BODY MANGA LONGA", "BODIES", 27, 99.9],
  ["SHORTS JEANS", "SHORTS", 41, 139.9],
  ["BRINCO DOURADO", "ACESSÓRIOS", 8, 39.9],
  ["COLAR CAMADAS", "ACESSÓRIOS", 11, 59.9],
  ["BOLSA TIRACOLO", "ACESSÓRIOS", 55, 199.9],
  ["KIMONO ESTAMPADO", "CASACOS", 71, 219.9],
  ["T-SHIRT BÁSICA", "T SHIRTS", 14, 59.9],
  ["MACACÃO PANTALONA", "MACACÕES", 96, 279.9],
  ["BLAZER ACINTURADO", "CASACOS", 124, 349.9]
] as const;

/** Aleatório com semente: o mesmo seed gera sempre a mesma demo. */
let semente = 20260824;
function aleatorio(): number {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
}
const entre = (min: number, max: number) => min + aleatorio() * (max - min);

async function limpar() {
  await prisma.stockSale.deleteMany({});
  await prisma.stockItem.deleteMany({});
  await prisma.stockSnapshot.deleteMany({});
  await prisma.accountBalance.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.financeMonth.deleteMany({});
  await prisma.dailyEntry.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.monthlyStats.deleteMany({});
  await prisma.importBatch.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.seller.deleteMany({});
  await prisma.period.deleteMany({});
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("schema=demo")) {
    throw new Error(
      "Este script só roda no schema de demonstração. A DATABASE_URL precisa terminar com schema=demo."
    );
  }

  await limpar();

  const sellers = [];
  for (const v of VENDEDORAS) {
    sellers.push({
      ...v,
      registro: await prisma.seller.create({ data: { sheetName: v.sheetName, name: v.name } })
    });
  }

  const senha = await bcrypt.hash("demo1234", 10);
  await prisma.user.create({
    data: {
      name: "Administrador da Demo",
      email: "demo@painel360.com.br",
      passwordHash: senha,
      role: "ADMIN",
      canViewFinance: true
    }
  });
  await prisma.user.create({
    data: {
      name: "Supervisora da Demo",
      email: "supervisora@painel360.com.br",
      passwordHash: senha,
      role: "SUPERVISORA"
    }
  });
  await prisma.user.create({
    data: {
      name: sellers[0].name,
      email: "vendedora@painel360.com.br",
      passwordHash: senha,
      role: "VENDEDORA",
      sellerId: sellers[0].registro.id
    }
  });

  const contas = await Promise.all(
    [
      { name: "Banco Principal", kind: "BANCO" as const, sortOrder: 1 },
      { name: "Maquininha", kind: "MAQUININHA" as const, sortOrder: 2 },
      { name: "Espécie", kind: "ESPECIE" as const, sortOrder: 3 }
    ].map((c) => prisma.account.create({ data: c }))
  );

  let saldoAnterior = [42000, 18500, 9200];

  // Anos anteriores, só o consolidado da loja, para o comparativo anual.
  for (const ano of [ANO - 3, ANO - 2, ANO - 1]) {
    const base = ano === ANO - 3 ? 62000 : ano === ANO - 2 ? 84000 : 108000;
    for (let mes = 1; mes <= 12; mes++) {
      const period = await prisma.period.create({ data: { year: ano, month: mes } });
      const receita = base * SAZONALIDADE[mes - 1] * entre(0.92, 1.08);
      const vendas = Math.round(receita / entre(150, 195));
      await prisma.monthlyStats.create({
        data: {
          scope: "STORE",
          periodId: period.id,
          revenue: receita.toFixed(2),
          salesCount: vendas,
          pieces: Math.round(vendas * entre(1.9, 2.4)),
          tkm: (receita / vendas).toFixed(2),
          pa: entre(1.9, 2.4).toFixed(2),
          note: "Resultado consolidado, importado do histórico da loja."
        }
      });
    }
  }

  // Ano corrente, completo: vendedoras, metas, despesas, pesquisa e saldos.
  for (let mes = 1; mes <= MES_ATUAL; mes++) {
    const period = await prisma.period.create({ data: { year: ANO, month: mes } });
    const emAndamento = mes === MES_ATUAL;
    const fracao = emAndamento ? 0.62 : 1;
    const diasUteis = 26;

    let receitaLoja = 0;
    let vendasLoja = 0;
    let pecasLoja = 0;

    for (const v of sellers) {
      if (v.entraNoMes && mes < v.entraNoMes) continue;

      const receita = 42000 * v.forca * SAZONALIDADE[mes - 1] * entre(0.88, 1.12) * fracao;
      const vendas = Math.round(receita / entre(155, 200));
      const pecas = Math.round(vendas * entre(1.8, 2.5));

      receitaLoja += receita;
      vendasLoja += vendas;
      pecasLoja += pecas;

      // Metas fixas por vendedora, como nas planilhas reais.
      const metaPrata = 32000 * v.forca;
      const metas: Array<[GoalLevel, number]> = [
        ["PRATA", metaPrata],
        ["OURO", metaPrata * 1.2],
        ["DIAMANTE", metaPrata * 1.45]
      ];

      const stats = await prisma.monthlyStats.create({
        data: {
          scope: "SELLER",
          periodId: period.id,
          sellerId: v.registro.id,
          revenue: receita.toFixed(2),
          salesCount: vendas,
          pieces: pecas,
          tkm: (receita / vendas).toFixed(2),
          pa: (pecas / vendas).toFixed(2),
          salao: (receita * entre(0.86, 0.98)).toFixed(2),
          online: (receita * entre(0.02, 0.14)).toFixed(2),
          workingDays: diasUteis,
          workedDays: emAndamento ? 16 : Math.round(entre(20, 25)),
          projection: emAndamento ? (receita / 0.62).toFixed(2) : null,
          npsScore: entre(8.4, 9.9).toFixed(2),
          npsResponses: Math.round(entre(8, 34))
        }
      });

      await prisma.goal.createMany({
        data: metas.map(([level, target]) => ({ statsId: stats.id, level, target: target.toFixed(2) }))
      });

      const diasNoMes = emAndamento ? 16 : 24;
      await prisma.dailyEntry.createMany({
        data: Array.from({ length: diasNoMes }, (_, i) => {
          const doDia = (receita / diasNoMes) * entre(0.45, 1.7);
          return {
            statsId: stats.id,
            day: i + 1,
            revenue: doDia.toFixed(2),
            sales: Math.max(1, Math.round((vendas / diasNoMes) * entre(0.5, 1.6))),
            pieces: Math.max(1, Math.round((pecas / diasNoMes) * entre(0.5, 1.6)))
          };
        })
      });
    }

    const metaLoja = 150000;
    const statsLoja = await prisma.monthlyStats.create({
      data: {
        scope: "STORE",
        periodId: period.id,
        revenue: receitaLoja.toFixed(2),
        salesCount: vendasLoja,
        pieces: pecasLoja,
        tkm: (receitaLoja / vendasLoja).toFixed(2),
        pa: (pecasLoja / vendasLoja).toFixed(2),
        workingDays: diasUteis,
        workedDays: emAndamento ? 16 : 24,
        projection: emAndamento ? (receitaLoja / 0.62).toFixed(2) : null,
        npsScore: entre(8.8, 9.7).toFixed(2),
        npsResponses: Math.round(entre(30, 90))
      }
    });
    await prisma.goal.createMany({
      data: [
        { statsId: statsLoja.id, level: "PRATA" as GoalLevel, target: metaLoja.toFixed(2) },
        { statsId: statsLoja.id, level: "OURO" as GoalLevel, target: (metaLoja * 1.2).toFixed(2) },
        { statsId: statsLoja.id, level: "DIAMANTE" as GoalLevel, target: (metaLoja * 1.45).toFixed(2) }
      ]
    });

    // Despesas: em março o fornecedor pesa e o mês fecha no vermelho, para a
    // leitura em texto ter o que apontar.
    const pesoDoMes = mes === 3 ? 1.45 : entre(0.82, 1.02);
    for (const grupo of GRUPOS) {
      const totalGrupo = receitaLoja * grupo.fatia * pesoDoMes;
      const lancamentos = Math.round(entre(4, 12));
      await prisma.expense.createMany({
        data: Array.from({ length: lancamentos }, (_, i) => ({
          periodId: period.id,
          group: grupo.nome,
          description: `${grupo.nome.split(" ")[0]} — lançamento ${i + 1}`,
          amount: (totalGrupo / lancamentos).toFixed(2),
          dueDate: new Date(Date.UTC(ANO, mes - 1, Math.min(28, 3 + i * 2))),
          paidAt: i === 0 && mes === MES_ATUAL ? null : new Date(Date.UTC(ANO, mes - 1, Math.min(28, 3 + i * 2))),
          sourceRow: i + 2
        }))
      });
    }
    await prisma.financeMonth.create({
      data: { periodId: period.id, grossRevenue: receitaLoja.toFixed(2) }
    });

    // Saldos das contas: o fim de um mês vira o início do seguinte.
    for (let i = 0; i < contas.length; i++) {
      const inicio = saldoAnterior[i];
      const fim = inicio * entre(0.9, 1.22);
      await prisma.accountBalance.create({
        data: {
          accountId: contas[i].id,
          periodId: period.id,
          opening: inicio.toFixed(2),
          closing: fim.toFixed(2)
        }
      });
      saldoAnterior[i] = fim;
    }
  }

  // Estoque com as quatro situações que o dashboard aponta.
  const hoje = new Date();
  const inicioVendas = new Date(hoje.getTime() - 120 * 86400000);
  const itens = PRODUTOS.map(([descricao, categoria, custo, preco], i) => ({
    barcode: String(100 + i),
    code: String(100 + i),
    description: descricao,
    category: categoria,
    quantity: i % 7 === 0 ? 0 : i % 5 === 0 ? Math.round(entre(28, 70)) : Math.round(entre(2, 14)),
    cost: custo,
    price: preco,
    status: "ATIVO",
    supplier: `Fornecedor ${String.fromCharCode(65 + (i % 4))}`
  }));
  await prisma.stockItem.createMany({ data: itens });

  const vendasEstoque = [];
  for (const item of itens) {
    // Um a cada quatro produtos não vende nada: é o "estoque parado" da tela.
    if (Number(item.barcode) % 4 === 0) continue;
    const quantas = Math.round(entre(2, 40));
    for (let i = 0; i < quantas; i++) {
      const dia = new Date(inicioVendas.getTime() + entre(0, 119) * 86400000);
      vendasEstoque.push({
        date: dia,
        orderNo: String(1000 + vendasEstoque.length),
        barcode: item.barcode,
        description: item.description,
        quantity: 1,
        cost: item.cost,
        unitPrice: item.price,
        total: item.price,
        sellerName: VENDEDORAS[Math.floor(aleatorio() * VENDEDORAS.length)].sheetName
      });
    }
  }
  await prisma.stockSale.createMany({ data: vendasEstoque });
  await prisma.stockSnapshot.create({
    data: {
      fileName: "estoque-demonstracao.xlsx",
      itemCount: itens.length,
      saleCount: vendasEstoque.length,
      salesFrom: inicioVendas,
      salesTo: hoje
    }
  });

  console.log(`Demo pronta: ${sellers.length} vendedoras, ${MES_ATUAL} meses do ano corrente,`);
  console.log(`3 anos de histórico, ${itens.length} produtos e ${vendasEstoque.length} vendas de item.`);
  console.log("Acessos: demo@painel360.com.br / supervisora@ / vendedora@ — senha demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
