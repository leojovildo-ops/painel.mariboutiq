import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  sellerId: string | null;
}

/** Exige sessão em páginas do app; sem sessão, volta para o login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

/** Telas e rotas de administração (upload, correção de valores, usuários). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/ranking");
  return user;
}

/** Versão para rotas de API: devolve null em vez de redirecionar. */
export async function apiUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser) ?? null;
}
