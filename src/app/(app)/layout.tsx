import { requireUser } from "@/lib/rbac";
import { firstName } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";

/** Saudação pelo horário — a marca é acolhedora, então o painel chama pelo nome. */
function greetingFor(name: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return `${saudacao}, ${firstName(name)}`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <Shell
      role={user.role}
      name={user.name}
      greeting={greetingFor(user.name)}
      canViewFinance={user.canViewFinance}
    >
      {children}
    </Shell>
  );
}
