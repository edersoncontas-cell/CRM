// Servidor da Evolution sem resposta (02/10, print dele às 10:18:
// "http://147.15.65.44:8080 não respondeu em 10s", fora do ar há 2h).
//
// Nada no CRM traz a VPS de volta: ela é dele, na hospedagem dele. O que o
// CRM pode é dizer QUAL das causas é — a tela antes listava três e mandava
// "entrar por SSH", que no celular, na rua, não é caminho — e o que tocar no
// painel da hospedagem. Duas pistas baratas decidem:
//   · o jeito que a porta 8080 falhou: RECUSOU (a máquina respondeu "não tem
//     ninguém aqui" → VPS ligada, Evolution parada) ou FICOU CALADA;
//   · calada, a porta do SSH (22) da mesma máquina responde? Responde → VPS
//     ligada, só a 8080 calada (firewall ou Evolution travada). Calada
//     também → a VPS inteira está fora (desligada, suspensa, outro IP).
// Regras puras (o cliente também usa); a sonda da porta: lib/sondar-porta.ts.

/** Começo da mensagem que evoFetch dá quando a Evolution não atende. */
export const PREFIXO_SERVIDOR_FORA = "Não consegui falar com o servidor da Evolution API";

export function servidorEvolutionFora(erro: string | null | undefined): boolean {
  return !!erro && erro.startsWith(PREFIXO_SERVIDOR_FORA);
}

export type FalhaRede = "tempo" | "recusada" | "dns" | "inalcancavel";

function codigoDoErro(e: unknown): string | null {
  // fetch (undici): TypeError("fetch failed") com o motivo em `cause`, às
  // vezes um AggregateError com a lista (IPv4 e IPv6).
  let atual: unknown = e;
  for (let i = 0; i < 4 && atual && typeof atual === "object"; i++) {
    const o = atual as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof o.code === "string") return o.code;
    if (Array.isArray(o.errors) && o.errors.length) atual = o.errors[0];
    else atual = o.cause;
  }
  return null;
}

export function classificarFalhaRede(e: unknown): FalhaRede {
  const nome = e && typeof e === "object" ? (e as { name?: unknown }).name : null;
  if (nome === "TimeoutError") return "tempo";
  const codigo = codigoDoErro(e);
  if (codigo === "ECONNREFUSED") return "recusada";
  if (codigo === "ENOTFOUND" || codigo === "EAI_AGAIN") return "dns";
  if (codigo === "ETIMEDOUT" || codigo === "UND_ERR_CONNECT_TIMEOUT") return "tempo";
  return "inalcancavel";
}

/** Texto curto para a mensagem de erro de cada chamada à Evolution. */
export function causaDaFalha(falha: FalhaRede, segundos: number): string {
  if (falha === "tempo") return `não respondeu em ${segundos}s`;
  if (falha === "recusada") return "recusou a conexão (a VPS está ligada, mas a Evolution está parada)";
  if (falha === "dns") return "não existe (o endereço não resolve)";
  return "está inalcançável (servidor desligado, porta fechada ou endereço errado)";
}

/** Porta do SSH da mesma máquina: "recusa" também prova que ela está ligada. */
export type PortaSsh = "responde" | "recusa" | "silencio" | "nao-testada";

export type EtapaServidor = { etapa: string; ok: boolean; detalhe: string };

const PAINEL = "o painel da hospedagem da VPS (na Hostinger: hpanel.hostinger.com → VPS → Gerenciar)";
const COMANDO_SUBIR = "cd /opt/evolution && docker compose up -d";
const ENQUANTO = " Enquanto o servidor não voltar, QR, religar e reiniciar não funcionam — os três dependem dele. Quando ele voltar, o CRM religa sozinho e só pede QR se precisar.";

export function hostDaUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^\[|\]$/g, ""); } catch { return ""; }
}

/**
 * Etapas e conclusão do diagnóstico quando a Evolution não atende.
 * `segundos`: quanto a chamada esperou; `ssh`: o que a porta 22 fez.
 */
export function concluirServidorFora(o: { url: string; falha: FalhaRede; ssh: PortaSsh; segundos: number; segundosSsh?: number }): { etapas: EtapaServidor[]; conclusao: string; comando?: string } {
  const host = hostDaUrl(o.url) || o.url;
  const etapas: EtapaServidor[] = [];
  const calada = o.falha === "tempo" ? `não respondeu em ${o.segundos}s` : "não atendeu";

  if (o.falha === "dns") {
    etapas.push({ etapa: "Servidor no ar", ok: false, detalhe: "o endereço não existe (o nome não resolve)" });
    return {
      etapas,
      conclusao: `O endereço ${o.url} não existe. Confira EVOLUTION_API_URL na Vercel (Settings → Environment Variables): tem de ser o IP ou o domínio da VPS, com :8080 no fim. Depois faça Redeploy.`,
    };
  }

  if (o.falha === "recusada") {
    etapas.push({ etapa: "Servidor no ar", ok: false, detalhe: "a VPS respondeu, mas nada atende na porta da Evolution — ela está parada" });
    return {
      etapas,
      conclusao:
        `Sua VPS está ligada, mas a Evolution está parada dentro dela. Pelo celular: abra ${PAINEL} e toque em Reiniciar — a Evolution sobe sozinha junto, em uns 3 minutos. ` +
        "Se em 5 minutos continuar assim, abra no mesmo painel o Terminal do navegador e cole o comando abaixo." + ENQUANTO,
      comando: COMANDO_SUBIR,
    };
  }

  etapas.push({ etapa: "Servidor no ar", ok: false, detalhe: `a porta da Evolution ${calada}` });
  const ssh = o.segundosSsh ?? 5;
  if (o.ssh === "responde" || o.ssh === "recusa") {
    etapas.push({ etapa: "VPS ligada", ok: true, detalhe: `a máquina ${host} respondeu na porta do SSH (22) — está ligada; só a porta da Evolution ficou calada` });
    return {
      etapas,
      conclusao:
        `Sua VPS está ligada, mas a porta da Evolution ficou calada: um firewall passou a bloqueá-la ou a Evolution travou. Pelo celular: abra ${PAINEL}. ` +
        "1) Em Firewall, tem de haver uma regra liberando TCP 8080 — se não houver, crie (ou desative o firewall). " +
        "2) Se a regra está lá, toque em Reiniciar a VPS; a Evolution sobe sozinha junto, em uns 3 minutos." + ENQUANTO,
    };
  }

  if (o.ssh === "silencio") {
    etapas.push({ etapa: "VPS ligada", ok: false, detalhe: `nem a porta do SSH (22) de ${host} respondeu em ${ssh}s — a VPS inteira está sem resposta` });
    return {
      etapas,
      conclusao:
        `Não é só a Evolution: a VPS inteira não responde — está desligada, suspensa ou com outro endereço. Pelo celular: abra ${PAINEL}. ` +
        "1) Se ela aparece parada ou suspensa, toque em Iniciar (suspensa costuma ser fatura em aberto ou manutenção — o painel diz qual). " +
        "2) Se aparece ligada, toque em Reiniciar. " +
        `3) Confira o IP mostrado lá: se não for ${host}, troque EVOLUTION_API_URL na Vercel e faça Redeploy. A Evolution sobe sozinha junto com a VPS.` + ENQUANTO,
    };
  }

  return {
    etapas,
    conclusao:
      `Nada responde em ${o.url}. Pelo celular: abra ${PAINEL}. Se a VPS está parada, toque em Iniciar; se está ligada, em Reiniciar — a Evolution sobe sozinha junto. ` +
      `Se o IP mostrado lá não for ${host}, troque EVOLUTION_API_URL na Vercel e faça Redeploy.` + ENQUANTO,
  };
}
