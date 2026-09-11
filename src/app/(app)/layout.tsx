import { requireUser } from "@/lib/rbac";
import { firstName } from "@/lib/format";
import { Shell } from "@/components/layout/Shell";
import { ultimaAtualizacao } from "@/lib/data/atualizacao";
import { contarAvisos } from "@/lib/data/avisosDeImportacao";

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
  const atualizado = await ultimaAtualizacao();
  // Só quem administra pode agir sobre os avisos, então só ela os conta.
  const avisos = user.role === "ADMIN" ? await contarAvisos() : 0;

  return (
    <Shell
      role={user.role}
      name={user.name}
      greeting={greetingFor(user.name)}
      canViewFinance={user.canViewFinance}
      atualizadoEm={atualizado ? atualizado.toISOString() : null}
      avisos={avisos}
    >
      {children}
    </Shell>
  );
}
