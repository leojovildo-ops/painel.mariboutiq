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

/**
 * A demonstração vai até o mês passado, e não até o corrente.
 *
 * O painel marca o mês corrente como "em andamento" e escreve "parcial" ao
 * lado da margem — correto no uso real, mas numa demo com valores fechados
 * aparece um mês cheio rotulado de parcial, o que confunde quem está vendo.
 */
const ULTIMO_MES = Math.max(1, new Date().getMonth());

/**
 * Quatro vendedoras, com valores fechados que somam exatos R$ 100.000 no mês.
 * A divisão é escolhida para cada uma cair num nível diferente e a tela de
 * gamificação mostrar os quatro estados de uma vez.
 */
const VENDEDORAS = [
  { sheetName: "ANA", name: "Ana Beatriz", receita: 32000 },
  { sheetName: "CAMILA", name: "Camila Rocha", receita: 28000 },
  { sheetName: "JULIA", name: "Júlia Mendes", receita: 22000 },
  { sheetName: "LARISSA", name: "Larissa Prado", receita: 18000 }
];

const FATURAMENTO_MES = 100000;

/** Metas iguais para todas, redondas: Ana bate Diamante, Camila Ouro,
 *  Júlia Prata e Larissa fica a caminho. */
const METAS_VENDEDORA: Array<[GoalLevel, number]> = [
  ["PRATA", 20000],
  ["OURO", 25000],
  ["DIAMANTE", 30000]
];

/** Metas da loja: o mês fecha exatamente no Diamante. */
const METAS_LOJA: Array<[GoalLevel, number]> = [
  ["PRATA", 80000],
  ["OURO", 90000],
  ["DIAMANTE", 100000]
];

/** Somam R$ 88.000 num mês normal: lucro de R$ 12.000, margem de 12%. */
const GRUPOS = [
  { nome: "FORNECEDOR", valor: 40000 },
  { nome: "DESPESAS FUNCIONÁRIOS", valor: 17000 },
  { nome: "IMPOSTOS", valor: 10000 },
  { nome: "CUSTOS FIXOS", valor: 8000 },
  { nome: "CUSTOS VARIÁVEIS", valor: 6000 },
  { nome: "DESPESAS PESSOAL DOS SÓCIOS", valor: 7000 }
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
    const base = ano === ANO - 3 ? 55000 : ano === ANO - 2 ? 70000 : 85000;
    for (let mes = 1; mes <= 12; mes++) {
      const period = await prisma.period.create({ data: { year: ano, month: mes } });
      // Valores redondos, com dezembro mais forte, para o comparativo anual
      // mostrar crescimento sem parecer gerado por sorteio.
      const receita = mes === 12 ? base * 1.5 : base;
      const vendas = Math.round(receita / 175);
      await prisma.monthlyStats.create({
        data: {
          scope: "STORE",
          periodId: period.id,
          revenue: receita.toFixed(2),
          salesCount: vendas,
          pieces: vendas * 2,
          tkm: (receita / vendas).toFixed(2),
          pa: "2.00",
          note: "Resultado consolidado, importado do histórico da loja."
        }
      });
    }
  }

  // Ano corrente, completo: vendedoras, metas, despesas, pesquisa e saldos.
  for (let mes = 1; mes <= ULTIMO_MES; mes++) {
    const period = await prisma.period.create({ data: { year: ANO, month: mes } });
    // Todos os meses entram fechados, inclusive o corrente: a demonstração
    // abre no mês mais recente, e um mês pela metade mostraria R$ 62.000 e
    // ninguém batendo meta, em vez dos valores redondos que ela existe para
    // apresentar.
    const emAndamento = false;
    const fracao = 1;
    const diasUteis = 26;

    let receitaLoja = 0;
    let vendasLoja = 0;
    let pecasLoja = 0;

    for (const v of sellers) {
      const receita = v.receita * fracao;
      const vendas = Math.round(receita / 200);
      const pecas = vendas * 2;

      receitaLoja += receita;
      vendasLoja += vendas;
      pecasLoja += pecas;

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
          salao: (receita * 0.9).toFixed(2),
          online: (receita * 0.1).toFixed(2),
          workingDays: diasUteis,
          workedDays: emAndamento ? 16 : 24,
          projection: emAndamento ? (receita / 0.62).toFixed(2) : null,
          npsScore: entre(8.4, 9.9).toFixed(2),
          npsResponses: 20
        }
      });

      await prisma.goal.createMany({
        data: METAS_VENDEDORA.map(([level, target]) => ({
          statsId: stats.id,
          level,
          target: target.toFixed(2)
        }))
      });

      const diasNoMes = emAndamento ? 16 : 24;
      await prisma.dailyEntry.createMany({
        data: Array.from({ length: diasNoMes }, (_, i) => {
          const doDia = receita / diasNoMes;
          return {
            statsId: stats.id,
            day: i + 1,
            revenue: doDia.toFixed(2),
            sales: Math.max(1, Math.round(vendas / diasNoMes)),
            pieces: Math.max(1, Math.round(pecas / diasNoMes))
          };
        })
      });
    }

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
        npsScore: "9.40",
        npsResponses: 60
      }
    });
    await prisma.goal.createMany({
      data: METAS_LOJA.map(([level, target]) => ({
        statsId: statsLoja.id,
        level,
        target: target.toFixed(2)
      }))
    });

    // Despesas: em março o fornecedor pesa e o mês fecha no vermelho, para a
    // leitura em texto ter o que apontar.
    // Em março a compra de mercadoria dobra e o mês fecha no vermelho: sem um
    // mês ruim, a leitura em texto não teria o que apontar na demonstração.
    const pesoDoMes = mes === 3 ? 1.5 : 1;
    for (const grupo of GRUPOS) {
      const totalGrupo = grupo.valor * pesoDoMes * fracao;
      const lancamentos = 6;
      // Dividir por seis e arredondar deixaria centavos sobrando e o total do
      // mês sairia R$ 88.000,02. O resto vai todo no primeiro lançamento, e a
      // soma fecha no valor redondo.
      const porLancamento = Math.floor((totalGrupo * 100) / lancamentos) / 100;
      const resto = Number((totalGrupo - porLancamento * (lancamentos - 1)).toFixed(2));

      await prisma.expense.createMany({
        data: Array.from({ length: lancamentos }, (_, i) => ({
          periodId: period.id,
          group: grupo.nome,
          description: `${grupo.nome.split(" ")[0]} — lançamento ${i + 1}`,
          amount: (i === 0 ? resto : porLancamento).toFixed(2),
          dueDate: new Date(Date.UTC(ANO, mes - 1, Math.min(28, 3 + i * 2))),
          paidAt: i === 0 && mes === ULTIMO_MES ? null : new Date(Date.UTC(ANO, mes - 1, Math.min(28, 3 + i * 2))),
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

  console.log(`Demo pronta: ${sellers.length} vendedoras, ${ULTIMO_MES} meses do ano corrente,`);
  console.log(`3 anos de histórico, ${itens.length} produtos e ${vendasEstoque.length} vendas de item.`);
  console.log("Acessos: demo@painel360.com.br / supervisora@ / vendedora@ — senha demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
