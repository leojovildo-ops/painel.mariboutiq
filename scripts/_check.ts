import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: "admin@mariboutique.com.br" } });
  console.log("usuario:", u && { email: u.email, role: u.role, active: u.active });
  console.log("senha confere:", u ? await bcrypt.compare("fPiG5jtRcZCrKy", u.passwordHash) : null);
}
main().finally(() => prisma.$disconnect());
