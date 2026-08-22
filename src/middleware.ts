export { default } from "next-auth/middleware";

/** Todo o painel exige login; /login e as rotas do NextAuth ficam de fora. */
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|marca).*)"]
};
