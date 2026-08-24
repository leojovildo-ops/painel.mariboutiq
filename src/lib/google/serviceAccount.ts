/**
 * Autenticação na API do Google com conta de serviço.
 *
 * Feito na mão com `node:crypto` em vez de usar a biblioteca oficial: o fluxo
 * é um JWT assinado trocado por um token de acesso, cabe em poucas linhas, e
 * evita arrastar uma dependência grande para dentro das funções da Vercel.
 *
 * A chave da conta de serviço vive na variável de ambiente
 * GOOGLE_SERVICE_ACCOUNT_JSON (o arquivo JSON inteiro, como o Google entrega).
 */
import { createSign } from "crypto";

interface Credenciais {
  client_email: string;
  private_key: string;
}

const ESCOPO = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function lerCredenciais(): Credenciais {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!bruto) {
    throw new Error(
      "A conta de serviço do Google não está configurada (GOOGLE_SERVICE_ACCOUNT_JSON)."
    );
  }

  let json: Credenciais;
  try {
    // Aceita tanto o JSON puro quanto em base64, porque colar JSON com quebras
    // de linha em variável de ambiente costuma corromper a chave privada.
    const texto = bruto.trim().startsWith("{")
      ? bruto
      : Buffer.from(bruto, "base64").toString("utf8");
    json = JSON.parse(texto);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido.");
  }

  if (!json.client_email || !json.private_key) {
    throw new Error("O JSON da conta de serviço não tem client_email ou private_key.");
  }

  return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
}

function base64url(valor: string | Buffer): string {
  return Buffer.from(valor).toString("base64url");
}

let cache: { token: string; expiraEm: number } | null = null;

/** Token de acesso, reaproveitado enquanto for válido. */
export async function obterAccessToken(): Promise<string> {
  if (cache && cache.expiraEm > Date.now() + 60_000) return cache.token;

  const { client_email, private_key } = lerCredenciais();
  const agora = Math.floor(Date.now() / 1000);

  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: client_email,
      scope: ESCOPO,
      aud: TOKEN_URL,
      exp: agora + 3600,
      iat: agora
    })
  );

  const assinatura = createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(private_key)
    .toString("base64url");

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${assinatura}`
    })
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("[google] falha ao obter token:", detalhe.slice(0, 300));
    throw new Error("O Google recusou as credenciais da conta de serviço.");
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number };
  cache = { token: dados.access_token, expiraEm: Date.now() + dados.expires_in * 1000 };
  return dados.access_token;
}

export function contaDeServicoConfigurada(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_DRIVE_FOLDER_ID);
}
