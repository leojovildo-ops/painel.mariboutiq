import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { marca } from "@/lib/marca";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: `Entrar · ${marca.sistema}` };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/ranking");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[26rem]">
        <div className="mb-9 flex flex-col items-center gap-2">
          <Logo width={210} />
          <span className="label">
            {marca.usarLogotipo ? (
              <>
                Painel <span className="text-coral">360</span>
              </>
            ) : (
              marca.loja
            )}
          </span>
        </div>

        <div className="card p-7">
          <h1 className="font-display text-2xl font-bold text-creme">Bem-vinda de volta</h1>
          <p className="mt-1.5 text-sm text-creme-500">
            Entre para acompanhar as metas e o ranking da equipe.
          </p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-creme-700">
          Acesso restrito à equipe {marca.loja}.
        </p>
      </div>
    </main>
  );
}
