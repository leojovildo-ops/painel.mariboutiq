import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Faça login para continuar.", 401);
export const forbidden = () => jsonError("Esta ação é exclusiva do Administrador.", 403);

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message ?? "Dados inválidos.", 422);
  }
  console.error("[api]", error);
  return jsonError("Não foi possível concluir a operação. Tente de novo.", 500);
}
