import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "text" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() }
          });
          if (!user || !user.active) return null;

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sellerId: user.sellerId,
            canViewFinance: user.canViewFinance
          };
        } catch (error) {
          // Sem este log, uma falha de conexão com o banco vira o mesmo
          // "e-mail ou senha inválidos" da senha errada e fica impossível
          // diagnosticar o login em produção.
          console.error("[auth] falha ao autenticar:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sellerId = user.sellerId;
        token.canViewFinance = user.canViewFinance;
        return token;
      }

      // Sessões duram 30 dias, e o token guarda perfil e permissões do momento
      // do login. Sem reler do banco, dar ou tirar um acesso (o financeiro, por
      // exemplo) só valeria no próximo login — e desativar alguém não a
      // desconectaria. Por isso os dados são atualizados a cada requisição.
      if (!token.id) return token;
      try {
        const atual = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, active: true, sellerId: true, canViewFinance: true }
        });

        if (!atual || !atual.active) {
          // Acesso desativado: o token perde a identidade e as telas mandam
          // a pessoa de volta para o login.
          token.id = "";
          return token;
        }

        token.role = atual.role;
        token.sellerId = atual.sellerId;
        token.canViewFinance = atual.canViewFinance;
      } catch (error) {
        // Falha de banco não pode derrubar quem já está logado: mantém o token
        // como está e deixa a página lidar com o erro.
        console.error("[auth] falha ao atualizar a sessão:", error);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.sellerId = token.sellerId;
        session.user.canViewFinance = token.canViewFinance;
      }
      return session;
    }
  }
};

export function auth() {
  return getServerSession(authOptions);
}
