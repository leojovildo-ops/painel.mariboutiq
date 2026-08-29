"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApelidosVendedora } from "./ApelidosVendedora";

type Role = "ADMIN" | "SUPERVISORA" | "VENDEDORA";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  SUPERVISORA: "Supervisora",
  VENDEDORA: "Vendedora"
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  sellerId: string | null;
  sellerName: string | null;
  canViewFinance: boolean;
}

interface SellerRow {
  id: string;
  name: string;
  sheetName: string;
  active: boolean;
  aliases: string[];
}

function NewUserForm({ sellers, onDone }: { sellers: SellerRow[]; onDone: () => void }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "VENDEDORA" as Role,
    sellerId: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        sellerId: form.role === "VENDEDORA" ? form.sellerId || null : null
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível criar o login.");
      setBusy(false);
      return;
    }

    setForm({ name: "", email: "", password: "", role: "VENDEDORA", sellerId: "" });
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-base-600 bg-base-700/30 p-4">
      <p className="label mb-3">Novo acesso</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Nome completo"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          type="email"
          placeholder="E-mail"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="input"
          type="password"
          placeholder="Senha provisória (mín. 8 caracteres)"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select
          className="input"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
        >
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>

        {form.role === "VENDEDORA" && (
          <select
            className="input sm:col-span-2"
            required
            value={form.sellerId}
            onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
          >
            <option value="">Vincular a qual vendedora da planilha?</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name} (aba {seller.sheetName})
              </option>
            ))}
          </select>
        )}
      </div>

      {form.role === "VENDEDORA" && sellers.length === 0 && (
        <p className="mt-3 text-sm text-nivel-ouro">
          Traga a planilha de um mês do Drive antes de criar logins de vendedora — as vendedoras vêm das abas da planilha.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-coral-300">{error}</p>}

      <button type="submit" className="btn-primary mt-4" disabled={busy}>
        {busy ? "Criando…" : "Criar acesso"}
      </button>
    </form>
  );
}

export function UsersCard({
  users,
  sellers,
  podeGerirFinanceiro
}: {
  users: UserRow[];
  sellers: SellerRow[];
  /** Só quem já vê o financeiro pode liberar esse acesso a outra pessoa. */
  podeGerirFinanceiro: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível atualizar o acesso.");
    }
    setBusyId(null);
    router.refresh();
  }

  async function resetPassword(user: UserRow) {
    const password = window.prompt(`Nova senha para ${user.name} (mínimo 8 caracteres):`);
    if (!password) return;
    await patchUser(user.id, { password });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-creme">Acessos da equipe</h2>
        <p className="mt-1 text-sm text-creme-500">
          Vendedoras e supervisoras só visualizam; a administração é exclusiva deste perfil.
        </p>
      </div>

      <NewUserForm sellers={sellers.filter((s) => s.active)} onDone={() => router.refresh()} />

      {error && (
        <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
          {error}
        </p>
      )}

      <div className="card overflow-hidden">
        <ul>
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-base-600/50 p-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className={`font-semibold ${user.active ? "text-creme" : "text-creme-700 line-through"}`}>
                  {user.name}
                </p>
                <p className="mt-0.5 text-sm text-creme-500">
                  {user.email} · {ROLE_LABEL[user.role]}
                  {user.sellerName ? ` · ${user.sellerName}` : ""}
                </p>
                {user.canViewFinance && (
                  <span className="mt-1 inline-block rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Vê o financeiro
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === user.id}
                  onClick={() => resetPassword(user)}
                >
                  Nova senha
                </button>
                {podeGerirFinanceiro && user.role === "ADMIN" && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === user.id}
                    onClick={() => patchUser(user.id, { canViewFinance: !user.canViewFinance })}
                  >
                    {user.canViewFinance ? "Tirar financeiro" : "Dar financeiro"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === user.id}
                  onClick={() => patchUser(user.id, { active: !user.active })}
                >
                  {user.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {sellers.length > 0 && (
        <div className="card p-5">
          <p className="font-display text-lg font-bold text-creme">Vendedoras e a pesquisa</p>
          <p className="mb-2 mt-1 text-sm text-creme-500">
            As vendedoras vêm das abas das planilhas. Se na pesquisa de satisfação o nome dela aparece
            escrito de outro jeito, cadastre aqui separado por vírgula — o sistema já resolve sozinho erro
            de digitação e apelido que começa igual, mas o resto precisa desta lista.
          </p>
          <div>
            {sellers.map((seller) => (
              <ApelidosVendedora key={seller.id} seller={seller} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
