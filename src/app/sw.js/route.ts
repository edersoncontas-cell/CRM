// O service worker é SERVIDO POR AQUI (e não como arquivo fixo em public/)
// por um motivo só: o navegador só instala um service worker novo quando os
// BYTES do arquivo mudam. Um sw.js estático nunca muda entre um deploy e
// outro, então o navegador seguia com o worker velho e o cache velho — era
// por isso que uma atualização podia sair no ar e o CRM continuar mostrando
// a versão antiga no aparelho.
//
// Gerando aqui, o número da versão do deploy entra dentro do arquivo: muda o
// byte, o navegador instala o worker novo, e o activate apaga todo cache que
// não seja o desta versão.

import { codigoDoWorker } from "@/lib/sw-codigo";

export const dynamic = "force-dynamic";

function versaoDoDeploy(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.NEXT_PUBLIC_BUILD_ID ??
    "dev"
  ).slice(0, 12);
}

export async function GET() {
  // O código mora em lib/sw-codigo.ts (o teste gera e roda o worker de lá).
  const codigo = codigoDoWorker(versaoDoDeploy());

  return new Response(codigo, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // O navegador precisa reconferir o worker toda vez, senão ele mesmo
      // fica preso numa cópia velha e o problema volta.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
