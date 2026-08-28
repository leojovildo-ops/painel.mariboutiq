/**
 * Cria o primeiro login de Administrador. Nada mais é semeado: vendedoras,
 * metas e números vêm sempre da importação das planilhas reais.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@mariboutique.com.br").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "TrocarSenha123!";
  const name = process.env.SEED_ADMIN_NAME || "Administrador";

  // A senha entra tambem no update: sem isso, rodar o seed de novo mantinha em
  // silencio o hash antigo, e SEED_ADMIN_PASSWORD deixava de valer para entrar.
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", active: true, passwordHash },
    create: { email, name, role: "ADMIN", active: true, passwordHash }
  });

  console.log(`Administrador pronto: ${user.email}`);
  console.log("Troque a senha no primeiro acesso (Administração > Acessos da equipe > Nova senha).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
