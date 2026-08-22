# Painel Mariboutique 360

Painel de gestão de vendas da **Mari Boutique**. Fase 1: **metas da loja, ranking de vendas e ranking de nível**.
Não há módulo financeiro nesta fase — a navegação já reserva o espaço para ele ("Em breve").

Os dados vêm das planilhas mensais preenchidas na loja: o Administrador sobe o `.xlsx` do mês,
o sistema lê as abas, guarda os números no banco e atualiza os painéis. O sistema **não substitui**
as planilhas.

## Perfis

| Perfil | Acesso |
| --- | --- |
| **Administrador** | Tudo: upload das planilhas, correção de qualquer número, cadastro/desativação de acessos. |
| **Supervisora** | Só visualização — vê o desempenho completo de toda a equipe. |
| **Vendedora** | Só visualização — vê o ranking completo, com a própria posição destacada. |

Nenhum perfil vê dados financeiros da empresa (fora do escopo desta fase).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL (Supabase) + Prisma
- NextAuth (Credentials, sessão JWT) com os três perfis
- SheetJS (`xlsx`) para ler as planilhas, sempre no servidor

## Telas

- `/metas` — meta da loja no mês vs realizado, barra de progresso grande e projeção de fechamento.
- `/ranking` — placar das vendedoras por total vendido, com as 5 métricas (total, vendas, peças, P.A., TKM) e seletor de mês.
- `/niveis` — selo Prata / Ouro / Diamante de cada vendedora e barra até a meta do próximo nível.
- `/admin` — upload com conferência antes de salvar, correção manual de valores e acessos da equipe.

## Configuração local

```bash
npm install
cp .env.example .env.local     # preencha DATABASE_URL e NEXTAUTH_SECRET
npx prisma migrate deploy      # o banco de produção já está migrado
npm run seed                   # cria o primeiro Administrador
npm run dev
```

Gere o `NEXTAUTH_SECRET` com `openssl rand -base64 32`.

O seed cria o Administrador com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `.env.local`
(padrão: `admin@mariboutique.com.br` / `TrocarSenha123!`). **Troque a senha no primeiro acesso**
em Administração → Acessos da equipe → Nova senha.

## Banco de dados

Projeto Supabase: `painel-mariboutique-360` (região `sa-east-1`, plano free).
A migration inicial já está aplicada e registrada na tabela de controle do Prisma.

O app **não usa o usuário `postgres`**: existe um login dedicado, `painel_app`, criado direto no
Postgres. Assim a senha do administrador do banco não precisa circular. Ele não é dono das
tabelas, então o acesso vem de privilégios de tabela + uma policy de RLS por tabela restrita a
esse papel. Os papéis `anon` e `authenticated` continuam **sem policy nenhuma**, ou seja, a API
pública do Supabase segue fechada — o único caminho até os dados é o app.

A conexão usa o **Transaction Pooler** (IPv4), que funciona na Vercel. A conexão direta
`db.<ref>.supabase.co` só resolve em IPv6 e as funções serverless não conectam nela.

⚠️ **Migrations não passam pelo pooler.** A porta 6543 é modo transação e o motor de migration
do Prisma trava nela. Para rodar `prisma migrate`, aponte `DATABASE_URL` temporariamente para a
conexão direta (porta 5432), que funciona de uma máquina com IPv6.

## Como as planilhas são lidas

Uma aba por vendedora (o nome da aba é o primeiro nome dela) + uma aba `Mari Boutique` com o
consolidado. Abas de modelo (`LOJA`, `VEND`, `VEND 1`, `vend`…) são ignoradas.

**O detalhe que mais importa:** cada aba não tem uma tabela só — tem **três blocos de dias lado a
lado**, de cerca de dez dias cada:

| Bloco | Datas | Dados | Totais |
| --- | --- | --- | --- |
| 1 | coluna D | E–K | linha 19 |
| 2 | coluna M | N–T | linha 19 |
| 3 | coluna V | W–AC | linha 19 |

A linha 19 totaliza **apenas o bloco em que está**. Quem lê só o primeiro bloco vê cerca de um
terço do mês — foi exatamente esse o erro da primeira versão. O total do mês é a soma dos três
blocos, e é isso que bate com o `Total Mês` da planilha.

Cada bloco tem seu cabeçalho na linha 7: Faturamento, Vendas, SALÃO, ONLINE, Peças, PA, TM.

Nada é lido por endereço fixo de célula:

- **Os blocos são localizados procurando "Faturamento" na linha 7**, e a coluna de datas é a que
  vem imediatamente antes. Uma coluna a mais ou a menos não desalinha a leitura.
- **Metas, TKM, PA, projeção e dias úteis são achados pelo rótulo** (`Prata`, `Ouro`, `Diamante`,
  `TKM`, `PA`, `Projeção`, `dias uteis`), com o valor na célula ao lado. Os endereços mudam de uma
  planilha para outra; os rótulos não.
- **O dia vem da data da própria célula**, não da posição da linha.
- **O mês vem das datas da planilha**, não do nome do arquivo (o nome é só reserva, e entende
  tanto `AGOSTO VENDAS 2026` quanto `ABR 2026`).
- **Os totais são somados dia a dia** e conferidos contra o `Total Mês` da planilha; divergência
  vira aviso na tela de conferência, não erro.
- **`#DIV/0!` e demais erros do Excel viram "sem dado"**, nunca zero. TKM e PA são recalculados
  quando a planilha traz erro.
- **Dias de outro mês são descartados**: o terceiro bloco tem 31 casas mesmo em meses de 30 dias,
  então pode trazer o dia 1º do mês seguinte — que colidiria com o dia 1º do mês certo.
- **A equipe não é fixa**: cada aba nova vira uma vendedora no banco automaticamente.

Para conferir o leitor contra uma planilha real:

```bash
npx tsx scripts/conferirPlanilha.ts "/caminho/AGOSTO VENDAS 2026.xlsx"
```

Ele imprime os totais lidos ao lado do que a planilha calcula, para comparação direta.

O nome do arquivo define o mês (`JULHO_2026.xlsx`, `AGOSTO_VENDAS_2026.xlsx`). Se não der para
descobrir, a tela de importação pede o mês antes de salvar.

Reimportar um mês **substitui** os números daquele mês, inclusive correções manuais — a tela
avisa antes de confirmar.

## No ar

**https://painel-mariboutique-360.vercel.app** — projeto `mariboutiq/painel-mariboutique-360` na Vercel.

As três variáveis já estão salvas no projeto (production, preview e development):
`DATABASE_URL`, `NEXTAUTH_SECRET` e `NEXTAUTH_URL`.

Para publicar uma nova versão:

```bash
npx vercel deploy --prod
```

Dois detalhes que custaram caro e é bom não reintroduzir:

- **`NEXTAUTH_URL` precisa ser o domínio fixo** (`painel-mariboutique-360.vercel.app`). Sem ele,
  o NextAuth cai no `VERCEL_URL`, que é o endereço único de cada build — o login responde
  401 mesmo com a senha certa, porque o host do cookie não bate com o host acessado.
- **Não existe `middleware.ts`.** No Next 14 ele só roda no runtime Edge, que os deploys
  anônimos recusam. A proteção de verdade é server-side (`requireUser`/`requireAdmin` nos
  layouts e `apiUser` nas rotas) — veja `src/app/(app)/README-protecao.md`.

## Fora do escopo desta fase

Financeiro, despesas, lucro/margem, contas bancárias e estoque. A navegação mostra esses módulos
como "Fase 2" para deixar o lugar deles claro.
