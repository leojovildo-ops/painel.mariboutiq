import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      /** Preenchido só para VENDEDORA: usado para destacar a própria linha no ranking. */
      sellerId: string | null;
      /** Direito por pessoa (não por perfil) de ver o módulo financeiro. */
      canViewFinance: boolean;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    sellerId: string | null;
    canViewFinance: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    sellerId: string | null;
    canViewFinance: boolean;
  }
}
