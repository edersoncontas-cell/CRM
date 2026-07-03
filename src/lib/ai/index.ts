import Anthropic from "@anthropic-ai/sdk";
import { extrairHeuristica, type ExtracaoConversa } from "./heuristics";
import { agoraBrasiliaExtenso, saudacaoBrasilia } from "@/lib/utils";
import { MODEL_TAREFA } from "./config";

const MODEL = MODEL_TAREFA;
// Modelo de texto do Groq (grátis). Reaproveita a GROQ_API_KEY da transcrição.
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
// Provedor de IA disponível, em ordem de preferência: Anthropic > Groq.
function provedorIA(): "anthropic" | "groq" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

export function iaHabilitada() {
  return provedorIA() !== null;
}

// Nome amigável do provedor de IA ativo (para exibir na interface).
export function provedorIANome(): string | null {
  const p = provedorIA();
  if (p === "anthropic") return "Anthropic";
  if (p === "groq") return "Groq (grátis)";
  return null;
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Chamada unificada de LLM: usa Anthropic se houver chave, senão Groq (grátis).
// Retorna o texto bruto da resposta. Lança erro se nenhum provedor existir.
async function llmTexto(
  system: string,
  user: string,
  opts?: { maxTokens?: number; json?: boolean }
): Promise<string> {
  const prov = provedorIA();
  const maxTokens = opts?.maxTokens ?? 1024;

  if (prov === "anthropic") {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  if (prov === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: maxTokens,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error(`Falha no Groq (${res.status}): ${detalhe.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error("Nenhum provedor de IA configurado.");
}

const SCHEMA_INSTRUCAO = `Você é o cérebro de um CRM de um vendedor de máquinas pesadas da LINHA AMARELA / CONSTRUCTION
(New Holland Construction e Dynapac) no sul do Espírito Santo. O vendedor NÃO trabalha com máquinas
agrícolas nem tratores (não existe T7, TL, colheitadeira, etc. no portfólio dele).
Os equipamentos são: escavadeiras (ex: E215C), retroescavadeiras (ex: B95C), pás-carregadeiras (ex: W190B),
motoniveladoras (ex: RG170.B) e rolos compactadores Dynapac (ex: CA2500, CC2200).

Analise a conversa com um cliente e devolva SOMENTE um JSON válido, sem texto antes ou depois, com as chaves:
{
  "resumo": string,                       // 1-2 frases do que aconteceu
  "perfil": string,                       // perfil do cliente (construtora, empreiteira, locadora, prefeitura, etc.)
  "nomeCliente": string|null,             // nome do cliente, se identificável na conversa
  "telefoneCliente": string|null,         // telefone do cliente (só dígitos), se aparecer
  "municipio": string|null,               // cidade/município do cliente, se mencionado (ex: "Vila Velha")
  "maquina": string|null,                 // modelo SOMENTE se o cliente mencionar explicitamente (ex: "E215C", "B95C", "CA2500"). NUNCA invente um modelo. Se nada for citado, use null.
  "valor": number|null,                   // valor em reais (número puro)
  "condicaoPagamento": "avista"|"consorcio"|"financiamento"|"outro"|null,
  "concorrente": string|null,             // concorrente citado (Caterpillar, Komatsu, Volvo, JCB, Case, XCMG, Sany...)
  "dataVisita": string|null,              // ISO 8601 se houver agendamento de visita
  "sentimento": "positivo"|"neutro"|"negativo",
  "ehProspectReal": boolean,              // realmente negociou/pediu info de máquina?
  "rascunhoResposta": string              // resposta sugerida no tom do vendedor
}
REGRA CRÍTICA: o campo "maquina" só pode ser preenchido com um modelo que o cliente realmente citou na conversa.
Se o cliente não citar nenhum modelo, "maquina" DEVE ser null. Jamais use um modelo padrão/exemplo.`;

export async function analisarConversaIA(
  texto: string,
  opts?: {
    estiloDeFala?: string | null;
    base?: Date;
    modelosDestaque?: { marca: string; modelo: string; categoria: string }[];
  }
): Promise<ExtracaoConversa> {
  if (!iaHabilitada()) {
    return extrairHeuristica(texto, opts?.base);
  }

  try {
    const tom = opts?.estiloDeFala
      ? `\n\nEstilo de fala do vendedor (imite no rascunhoResposta):\n${opts.estiloDeFala}`
      : "";
    // Contexto temporal real (Brasília) para a IA datar visitas e SAUDAR corretamente.
    const agora = opts?.base ?? new Date();
    const contextoData =
      `\n\nDATA E HORA ATUAL (fuso de Brasília, use como base): ${agoraBrasiliaExtenso(agora)}.` +
      `\nAo cumprimentar no rascunhoResposta, use OBRIGATORIAMENTE "${saudacaoBrasilia(agora)}" conforme o período atual do dia` +
      ` — nunca copie a saudação de mensagens antigas do cliente.` +
      `\nAo interpretar datas relativas ("amanhã", "quinta", "semana que vem"), calcule a partir desta data atual.`;
    const modelos = opts?.modelosDestaque?.length
      ? `\n\nMODELOS MAIS COMERCIALIZADOS PELO VENDEDOR (priorize estes ao sugerir máquinas e ao construir argumentos de venda):\n` +
        opts.modelosDestaque.map((m) => `• ${m.marca} ${m.modelo} (${m.categoria})`).join("\n")
      : "";
    const raw = await llmTexto(SCHEMA_INSTRUCAO + contextoData + modelos + tom, `Conversa:\n${texto}`, {
      maxTokens: 1024,
      json: true,
    });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return {
      resumo: parsed.resumo ?? "",
      perfil: parsed.perfil ?? null,
      nomeCliente: parsed.nomeCliente ?? null,
      telefoneCliente: parsed.telefoneCliente ? String(parsed.telefoneCliente).replace(/\D/g, "") || null : null,
      municipio: parsed.municipio ?? null,
      maquina: parsed.maquina ?? null,
      valor: typeof parsed.valor === "number" ? parsed.valor : null,
      condicaoPagamento: parsed.condicaoPagamento ?? null,
      concorrente: parsed.concorrente ?? null,
      dataVisita: parsed.dataVisita ? new Date(parsed.dataVisita) : null,
      sentimento: parsed.sentimento ?? "neutro",
      ehProspectReal: !!parsed.ehProspectReal,
      rascunhoResposta: parsed.rascunhoResposta ?? "",
      fonte: "ia",
    };
  } catch (err) {
    console.error("Falha na IA, usando heurística:", err);
    return extrairHeuristica(texto, opts?.base);
  }
}

// Aprende o tom do vendedor a partir de mensagens dele (com fallback simples).
export async function aprenderTomIA(mensagensVendedor: string[]): Promise<string> {
  const amostra = mensagensVendedor.slice(0, 30).join("\n---\n");
  if (!iaHabilitada() || !amostra.trim()) {
    return "Tom cordial, direto e regional (sul do ES). Usa saudações calorosas, trata o cliente por 'você/senhor', foca em benefícios práticos da máquina e em fechar a visita.";
  }
  try {
    return await llmTexto(
      "Analise as mensagens de um vendedor e descreva em 3-5 linhas o tom/estilo dele (saudações, gírias, formalidade, emojis) para que outra IA imite. Responda só com a descrição.",
      amostra,
      { maxTokens: 512 }
    );
  } catch {
    return "Tom cordial, direto e regional. Foca em benefícios da máquina e em marcar a visita.";
  }
}

// Resume uma conversa de WhatsApp em poucos pontos objetivos para o vendedor
// revisar e decidir o próximo passo (criar card, agendar visita ou nada).
export async function resumirConversaIA(thread: string): Promise<string> {
  const texto = thread.trim();
  if (!texto) return "Sem mensagens nesta conversa.";
  if (!iaHabilitada()) {
    // Fallback: usa as últimas linhas da conversa como resumo bruto.
    const linhas = texto.split("\n").filter((l) => l.trim()).slice(-6);
    return linhas.join("\n");
  }
  try {
    return await llmTexto(
      `Você ajuda um vendedor de máquinas pesadas (New Holland Construction / Dynapac, sul do ES).
Resuma a conversa de WhatsApp abaixo em português, de forma curta e acionável, com bullets:
• O que o cliente quer / interesse principal
• Máquina(s) e valores mencionados (se houver)
• Concorrente citado (se houver)
• Visita/data combinada (se houver)
• Próximo passo sugerido
Seja objetivo. Não invente dados que não estão na conversa.`,
      `Conversa:\n${texto}`,
      { maxTokens: 512 }
    );
  } catch {
    const linhas = texto.split("\n").filter((l) => l.trim()).slice(-6);
    return linhas.join("\n");
  }
}

// Interpreta um COMANDO em linguagem natural (voz/texto) do vendedor e devolve
// uma lista de ações estruturadas para o assistente do CRM executar (após
// confirmação). Não inventa dados; se não entender, devolve lista vazia.
export async function interpretarComandoIA(
  texto: string,
  opts?: { base?: Date }
): Promise<{ resposta: string; acoes: Record<string, unknown>[] }> {
  if (!iaHabilitada()) {
    return { resposta: "A IA não está configurada (defina ANTHROPIC_API_KEY ou GROQ_API_KEY).", acoes: [] };
  }
  const agora = opts?.base ?? new Date();
  const system = `Você é o assistente de um CRM de um vendedor de máquinas pesadas (New Holland Construction / Dynapac, sul do ES).
Converta o COMANDO do vendedor em ações estruturadas. Responda SOMENTE com JSON válido, sem texto fora do JSON:
{
  "resposta": string,   // fala curta e amigável confirmando o que entendeu
  "acoes": []           // lista de ações (vazia se não entendeu)
}
Tipos de ação válidos (use exatamente estes valores em "tipo"):
- {"tipo":"criar_cliente","nome":string,"telefone"?:string,"municipio"?:string,"observacoes"?:string,"interesseFuturo"?:boolean,"interesseFuturoData"?:"YYYY-MM-DD","interesseFuturoNota"?:string}
- {"tipo":"editar_cliente","cliente":string,"telefone"?:string,"municipio"?:string,"observacoes"?:string,"jaComprou"?:boolean,"visitado"?:boolean,"interesseFuturo"?:boolean,"interesseFuturoData"?:"YYYY-MM-DD","interesseFuturoNota"?:string}
- {"tipo":"editar_resumo","cliente":string,"resumoMaquinas"?:string,"resumoTexto"?:string,"resumoValor"?:number,"resumoCondicao"?:"pesquisando"|"interesse_futuro"|"avista"|"financiamento"|"consorcio","proximaVisita"?:"YYYY-MM-DD","proximaVisitaNota"?:string}
- {"tipo":"criar_card","cliente":string,"estagio"?:string,"maquina"?:string,"valor"?:number}
- {"tipo":"criar_tarefa","titulo":string,"descricao"?:string,"coluna"?:string}
- {"tipo":"agendar_visita","cliente":string,"data":"YYYY-MM-DD","observacao"?:string}
Regras:
- "cliente" = nome APROXIMADO do cliente como o vendedor falou (o sistema buscará por nome similar no cadastro, tolerando erros de digitação).
- Use "editar_resumo" quando o vendedor mencionar: histórico, compra, valor pago, máquina que o cliente tem, resumo do atendimento, situação do cliente, o que foi conversado, intenção de compra, próxima visita.
- "criar_card" = card no funil de negociação. Estágios válidos: "primeiro_contato","visita_pendente","visita_realizada","proposta_bcnh","proposta_aprovada". Se não souber, omita.
- "criar_tarefa" = demanda/lembrete estilo Trello. "coluna" é opcional (ex: "Demandas").
- Interprete datas relativas ("amanhã","sexta","semana que vem") a partir da DATA ATUAL: ${agoraBrasiliaExtenso(agora)}.
- Um comando pode gerar mais de uma ação. Não invente dados. Se não corresponder a nenhuma ação, devolva "acoes": [].`;
  try {
    const raw = await llmTexto(system, `Comando: ${texto}`, { maxTokens: 1024, json: true });
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      resposta: typeof parsed.resposta === "string" ? parsed.resposta : "",
      acoes: Array.isArray(parsed.acoes) ? parsed.acoes : [],
    };
  } catch (err) {
    console.error("Falha ao interpretar comando:", err);
    return { resposta: "Não consegui entender o comando. Pode reformular?", acoes: [] };
  }
}

// Gera um post de mídia chamativo sobre uma máquina (curiosidade/atração).
export async function gerarMidiaIA(maquina: {
  modelo: string;
  categoria: string;
  descricao?: string | null;
  curiosidades?: string | null;
}): Promise<{ titulo: string; conteudo: string }> {
  if (!iaHabilitada()) {
    return {
      titulo: `Você conhece a ${maquina.modelo}?`,
      conteudo: `🚜 A New Holland ${maquina.modelo} (${maquina.categoria}) é potência e economia no mesmo lugar! ${
        maquina.curiosidades || maquina.descricao || "Tecnologia de ponta para o seu negócio crescer."
      }\n\nQuer saber as condições? Me chama aqui! 👇`,
    };
  }
  try {
    const raw = await llmTexto(
      "Você é social media de um vendedor New Holland. Crie um post curto, chamativo e com emojis para WhatsApp/Instagram sobre a máquina. Devolva JSON: {\"titulo\": string, \"conteudo\": string}.",
      `Máquina: ${maquina.modelo} (${maquina.categoria}). ${maquina.descricao ?? ""} Curiosidades: ${maquina.curiosidades ?? ""}`,
      { maxTokens: 600, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return { titulo: parsed.titulo, conteudo: parsed.conteudo };
  } catch {
    return {
      titulo: `Conheça a ${maquina.modelo}`,
      conteudo: `🚜 New Holland ${maquina.modelo}: ${maquina.descricao ?? "performance e economia para o seu dia a dia."}`,
    };
  }
}

// Gera/preenche a FICHA TÉCNICA de uma máquina a partir do conhecimento da IA
// (modelos New Holland Construction, Dynapac e concorrentes do ramo construction).
// Retorna campos vazios se a IA não estiver habilitada — nunca inventa fonte.
export async function gerarFichaTecnicaIA(maquina: {
  marca: string;
  modelo: string;
  categoria: string;
  proprio: boolean;
}): Promise<{
  especificacoes: string;
  descricao: string;
  pontosFortes: string;
  diferenciais: string;
}> {
  const vazio = { especificacoes: "", descricao: "", pontosFortes: "", diferenciais: "" };
  if (!iaHabilitada()) return vazio;

  try {
    const campos = maquina.proprio
      ? `{
  "especificacoes": string,  // ficha técnica em linhas "Atributo: valor" (uma por linha). Inclua: Motor, Potência (cv), Peso operacional (kg), e os principais dados da categoria (capacidade de caçamba, profundidade/altura de escavação, força de escavação, largura de trabalho, etc.)
  "descricao": string,       // 1-2 frases sobre a máquina e seu uso principal
  "pontosFortes": string,    // argumentos de venda, separados por ';'
  "diferenciais": string     // diferenciais de mercado, separados por ';'
}`
      : `{
  "especificacoes": string,  // ficha técnica em linhas "Atributo: valor" (uma por linha): Motor, Potência (cv), Peso operacional (kg) e principais dados da categoria
  "descricao": string,       // 1-2 frases sobre a máquina
  "pontosFortes": "",        // deixe vazio para máquina concorrente
  "diferenciais": ""         // deixe vazio para máquina concorrente
}`;

    const raw = await llmTexto(
      `Você é um especialista técnico em máquinas pesadas do ramo construction (linha amarela) no Brasil.
Gere a ficha técnica da máquina informada com base em especificações públicas dos fabricantes.
Use unidades do mercado brasileiro (cv, kg, m³, mm, kN). Se algum dado não for conhecido com segurança, omita a linha — NUNCA invente números.
Devolva SOMENTE um JSON válido, sem texto fora do JSON, no formato:
${campos}`,
      `Máquina: ${maquina.marca} ${maquina.modelo} — categoria ${maquina.categoria}.`,
      { maxTokens: 900, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      especificacoes: typeof parsed.especificacoes === "string" ? parsed.especificacoes.trim() : "",
      descricao: typeof parsed.descricao === "string" ? parsed.descricao.trim() : "",
      pontosFortes: typeof parsed.pontosFortes === "string" ? parsed.pontosFortes.trim() : "",
      diferenciais: typeof parsed.diferenciais === "string" ? parsed.diferenciais.trim() : "",
    };
  } catch (err) {
    console.error("Falha ao gerar ficha técnica:", err);
    return vazio;
  }
}

// Extrai a ficha técnica de um ARQUIVO anexado (PDF ou imagem do catálogo).
// Usa o Claude (Anthropic), que lê PDF e imagem nativamente. O arquivo NÃO é
// guardado — só o conteúdo extraído. Exige ANTHROPIC_API_KEY (o Groq não lê PDF).
export async function extrairFichaDeArquivoIA(
  maquina: { marca: string; modelo: string; categoria: string; proprio: boolean },
  arquivo: { base64?: string; mediaType?: string; texto?: string }
): Promise<{
  ok: boolean;
  especificacoes?: string;
  descricao?: string;
  pontosFortes?: string;
  diferenciais?: string;
  consumoLitrosHora?: number | null;
  valorInicial?: number | null;
  erro?: string;
}> {
  const ehTexto = !!arquivo.texto;
  const ehPdf = arquivo.mediaType === "application/pdf";
  const ehImagem = !!arquivo.mediaType?.startsWith("image/");

  // PDF/imagem exigem a Anthropic (lê nativamente). Texto pode usar Groq também.
  if (!ehTexto && !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, erro: "A leitura de PDF/imagem exige a chave da Anthropic (ANTHROPIC_API_KEY)." };
  }
  if (!ehTexto && !ehPdf && !ehImagem) {
    return { ok: false, erro: "Formato não suportado. Envie PDF, imagem (JPG/PNG) ou texto/HTML." };
  }

  const campos = maquina.proprio
    ? `{
  "especificacoes": string,       // ficha técnica em linhas "Atributo: valor" (uma por linha): Motor, Potência (cv), Peso operacional (kg) e os principais dados da categoria
  "descricao": string,            // 1-2 frases sobre a máquina e seu uso principal
  "pontosFortes": string,         // argumentos de venda separados por ';'
  "diferenciais": string,         // diferenciais de mercado separados por ';'
  "consumoLitrosHora": number|null, // consumo de diesel em litros/hora, se constar (só o número)
  "valorInicial": number|null     // preço/valor em reais, se constar (só o número, sem R$ nem pontos)
}`
    : `{
  "especificacoes": string,       // ficha técnica em linhas "Atributo: valor" (uma por linha)
  "descricao": string,            // 1-2 frases sobre a máquina
  "pontosFortes": "",
  "diferenciais": "",
  "consumoLitrosHora": number|null, // consumo de diesel em litros/hora, se constar
  "valorInicial": null
}`;

  const system = `Você é um especialista técnico em máquinas pesadas do ramo construction (linha amarela).
Leia o conteúdo (catálogo/ficha do fabricante/comparativo) e EXTRAIA as especificações técnicas da máquina.
Use unidades do mercado brasileiro (cv, kg, m³, mm, kN, L/h). Extraia SOMENTE o que estiver no conteúdo — NUNCA invente números.
Se trouxer várias máquinas, foque na ${maquina.marca} ${maquina.modelo}.
Devolva SOMENTE um JSON válido, sem texto fora do JSON, no formato:
${campos}`;

  const finalizar = (parsed: Record<string, unknown>) => {
    const especificacoes = typeof parsed.especificacoes === "string" ? parsed.especificacoes.trim() : "";
    if (!especificacoes && !parsed.descricao) {
      return { ok: false as const, erro: "Não consegui extrair dados do arquivo. Tente outro mais legível." };
    }
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
    return {
      ok: true as const,
      especificacoes,
      descricao: typeof parsed.descricao === "string" ? parsed.descricao.trim() : "",
      pontosFortes: typeof parsed.pontosFortes === "string" ? parsed.pontosFortes.trim() : "",
      diferenciais: typeof parsed.diferenciais === "string" ? parsed.diferenciais.trim() : "",
      consumoLitrosHora: num(parsed.consumoLitrosHora),
      valorInicial: num(parsed.valorInicial),
    };
  };

  try {
    // Caminho de TEXTO/HTML — usa o LLM de texto (Groq ou Anthropic).
    if (ehTexto) {
      const raw = await llmTexto(system, `Conteúdo do arquivo:\n\n${arquivo.texto}`, { maxTokens: 1500, json: true });
      if (!raw) return { ok: false, erro: "IA não habilitada. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
      return finalizar(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    }

    // Caminho de PDF/IMAGEM — Claude lê nativamente.
    const bloco = ehPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: arquivo.base64! } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: arquivo.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: arquivo.base64! } };

    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: [bloco, { type: "text" as const, text: `Extraia a ficha técnica da ${maquina.marca} ${maquina.modelo} (${maquina.categoria}).` }] as Anthropic.MessageParam["content"],
        },
      ],
    });
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return finalizar(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  } catch (err) {
    console.error("Falha ao extrair ficha de arquivo:", err);
    return { ok: false, erro: "Erro ao ler o arquivo. Verifique se é um PDF, imagem ou texto válido." };
  }
}

// Gera um BATTLECARD preciso (minha máquina vs concorrente) usando as fichas
// técnicas de ambas para comparar números reais e montar o argumento de venda.
export async function gerarBattlecardIA(
  minha: { marca: string; modelo: string; categoria: string; especificacoes?: string | null; pontosFortes?: string | null },
  conc: { marca: string; modelo: string; especificacoes?: string | null }
): Promise<string> {
  if (!iaHabilitada()) return "";
  try {
    return await llmTexto(
      `Você é consultor de vendas de máquinas pesadas (New Holland Construction / Dynapac) no sul do ES.
Compare a MINHA máquina com a do CONCORRENTE usando as fichas técnicas fornecidas.
Escreva um argumento de venda CURTO (3-4 frases), comparando números reais quando existirem (peso, potência, capacidade, força).
Seja honesto: se o concorrente tem vantagem em algo, reconheça e compense com pós-venda, revenda, custo, rede de peças e Finame.
Responda apenas com o texto do argumento, sem títulos nem JSON.`,
      `MINHA: ${minha.marca} ${minha.modelo} (${minha.categoria})
Ficha: ${minha.especificacoes ?? "—"}
Pontos fortes: ${minha.pontosFortes ?? "—"}

CONCORRENTE: ${conc.marca} ${conc.modelo}
Ficha: ${conc.especificacoes ?? "—"}`,
      { maxTokens: 400 }
    );
  } catch (err) {
    console.error("Falha ao gerar battlecard:", err);
    return "";
  }
}

// Análise completa de uma CATEGORIA no estilo "Super Trunfo": compara minhas
// máquinas (New Holland/Dynapac) com os concorrentes da categoria e devolve um
// resumo com argumentos de venda prontos. Usa as fichas técnicas para precisão.
export async function gerarAnaliseCategoriaIA(
  categoriaLabel: string,
  minhas: { marca: string; modelo: string; especificacoes?: string | null }[],
  concorrentes: { marca: string; modelo: string; especificacoes?: string | null }[]
): Promise<string> {
  if (!iaHabilitada()) return "";
  const ficha = (m: { marca: string; modelo: string; especificacoes?: string | null }) =>
    `${m.marca} ${m.modelo}:\n${m.especificacoes ?? "(ficha não preenchida)"}`;
  try {
    return await llmTexto(
      `Você é consultor sênior de vendas de máquinas pesadas New Holland Construction e Dynapac no sul do Espírito Santo.
Escreva uma análise comercial PROFISSIONAL e COMPLETA da categoria "${categoriaLabel}", comparando as MINHAS máquinas com os CONCORRENTES.
Estruture assim (use estes títulos com markdown):
**Panorama da categoria** — 2-3 frases situando onde minhas máquinas se posicionam (peso, potência, faixa de aplicação).
**Onde eu ganho** — bullets objetivos com vantagens reais (números das fichas quando houver: peso, potência, força, capacidade) + pós-venda, rede de peças, Finame, revenda.
**Pontos de atenção** — seja honesto: onde o concorrente leva vantagem e como contornar no discurso.
**Argumentos prontos de venda** — 3 a 5 frases de impacto que o vendedor pode usar direto com o cliente.
Use linguagem do dia a dia da obra, direta e confiante. Não invente números que não estejam nas fichas.`,
      `CATEGORIA: ${categoriaLabel}

MINHAS MÁQUINAS:
${minhas.map(ficha).join("\n\n")}

CONCORRENTES:
${concorrentes.map(ficha).join("\n\n")}`,
      { maxTokens: 1100 }
    );
  } catch (err) {
    console.error("Falha na análise de categoria:", err);
    return "";
  }
}

// ────────────────────────────────────────────────────────────
// Marketing post generation
// ────────────────────────────────────────────────────────────

export type TipoPost =
  | "diario"
  | "segunda"
  | "sexta"
  | "mensal_inicio"
  | "mensal_fim"
  | "avulso";

export interface PostMarketing {
  titulo: string;
  corpo: string;
  hashtags: string;
}

const TEMA_POR_TIPO: Record<TipoPost, string> = {
  diario: "dica técnica rápida, curiosidade ou vantagem específica de uma máquina",
  segunda: "motivação para a semana + oportunidade comercial (Finame/BNDES/consórcio)",
  sexta: "resultado da semana + call-to-action forte para fechar antes do final de semana",
  mensal_inicio: "abertura do mês: novidades, promoções, convite para visita técnica",
  mensal_fim: "últimos dias do mês, urgência comercial, condições que vencem",
  avulso: "post chamativo e criativo sobre a máquina ou linha de equipamentos",
};

export async function gerarPostMarketingIA(
  maquina: {
    modelo: string;
    marca: string;
    categoria: string;
    descricao?: string | null;
    pontosFortes?: string | null;
    curiosidades?: string | null;
  } | null,
  tipo: TipoPost,
  feedbackAnterior?: string,
  conteudoAnterior?: string,
    imagem?: { base64: string; mediaType: string }
): Promise<PostMarketing> {
  if (!iaHabilitada()) {
    return _postHeuristico(maquina, tipo);
  }

  const tema = TEMA_POR_TIPO[tipo] ?? TEMA_POR_TIPO.avulso;
  const infoMaquina = maquina
    ? `Máquina: ${maquina.marca} ${maquina.modelo} (${maquina.categoria}). ${maquina.descricao ?? ""} Pontos fortes: ${maquina.pontosFortes ?? ""} Curiosidades: ${maquina.curiosidades ?? ""}`
    : "Linha completa de máquinas pesadas";

  const feedbackPart =
    feedbackAnterior && conteudoAnterior
      ? `\n\n⚠️ INSTRUÇÃO OBRIGATÓRIA DO VENDEDOR (siga à risca, sem exceção):\n---\n${conteudoAnterior}\n---\nINSTRUÇÃO DO VENDEDOR (execute EXATAMENTE): "${feedbackAnterior}"

ATENÇÃO: Se o vendedor pediu um modelo específico, use ESSE modelo e nenhum outro.`
      : "";

  try {
    // Se houver imagem e Anthropic disponível, usa vision para criar post baseado na foto
    if (imagem && process.env.ANTHROPIC_API_KEY) {
      const systemVision = `Você é o social media de Ederson, vendedor de máquinas pesadas New Holland Construction e Dynapac no sul do Espírito Santo (Brasil).
Analise a imagem da máquina enviada e crie um post CRIATIVO, com emojis estratégicos, linguagem profissional mas próxima.
Tema do post: ${tema}.
REGRA IMPORTANTE: NUNCA misture New Holland com Dynapac no mesmo post.
Descreva o que vê na imagem e use isso para enriquecer o post. Use dados reais de produtividade/economia quando disponíveis.
Devolva SOMENTE um JSON válido (sem texto fora do JSON):
{"titulo": string, "corpo": string, "hashtags": string}
"corpo": texto completo do post com emojis, máx 450 caracteres para WhatsApp.
"hashtags": string com hashtags separadas por espaço.`;
      const resp = await client().messages.create({
        model: MODEL,
        max_tokens: 800,
        system: systemVision,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imagem.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: imagem.base64 } },
            { type: "text", text: `${infoMaquina}${feedbackPart}` },
          ],
        }],
      });
      const visionRaw = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      const visionParsed = JSON.parse(visionRaw.slice(visionRaw.indexOf("{"), visionRaw.lastIndexOf("}") + 1));
      return {
        titulo: visionParsed.titulo ?? "Post de marketing",
        corpo: visionParsed.corpo ?? "",
        hashtags: visionParsed.hashtags ?? "",
      };
    }
    const raw = await llmTexto(
      `Você é o social media de Ederson, vendedor de máquinas pesadas New Holland Construction e Dynapac no sul do Espírito Santo (Brasil).
Crie posts CRIATIVOS, com emojis estratégicos, linguagem profissional mas próxima.
Tema do post: ${tema}.
REGRA IMPORTANTE: NUNCA misture New Holland com Dynapac no mesmo post.
Seja específico, mencione o modelo da máquina. Use dados reais de produtividade/economia quando disponíveis.
Devolva SOMENTE um JSON válido (sem texto fora doh JSON):
{"titulo": string, "corpo": string, "hashtags": string}
"corpo": texto completo do post com emojis, máx 450 caracteres para WhatsApp.
"hashtags": string com hashtags separadas por espaço.`,
      `${infoMaquina}${feedbackPart}`,
      { maxTokens: 800, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      titulo: parsed.titulo ?? "Post de marketing",
      corpo: parsed.corpo ?? "",
      hashtags: parsed.hashtags ?? "",
    };
  } catch {
    return _postHeuristico(maquina, tipo);
  }
}

function _postHeuristico(
  maquina: { modelo: string; marca: string; categoria: string; curiosidades?: string | null } | null,
  tipo: TipoPost
): PostMarketing {
  const modelo = maquina?.modelo ?? "E245C";
  const marca = maquina?.marca ?? "New Holland";
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const curiosidade =
    maquina?.curiosidades ?? "eficiência de combustível superior e conforto operador de alto nível";

  const templates: Record<TipoPost, PostMarketing> = {
    diario: {
      titulo: `💡 Sabia disso sobre a ${marca} ${modelo}?`,
      corpo: `🔧 Dica do dia!\n\n${marca} ${modelo}: ${curiosidade}.\n\nIsso significa MAIS OBRA com MENOS custo. 💪\n\nQuer um comparativo técnico? Me chama! 👇`,
      hashtags: `#${marca.replace(/ /g, "")} #${modelo} #MaquinaPesada #Construção #SulES`,
    },
    segunda: {
      titulo: `🚀 Segunda de conquistas — bora fechar!`,
      corpo: `Bom dia! 🌅 Semana nova, oportunidade nova!\n\nA ${marca} ${modelo} está disponível com condições especiais Finame/BNDES. Parcelas que cabem no seu fluxo de caixa!\n\n✅ Taxa reduzida\n✅ Demonstração gratuita\n✅ Proposta em 24h\n\nMe chama! 👇`,
      hashtags: `#SegundaFeira #${marca.replace(/ /g, "")} #Finame #MaquinaPesada #Construção`,
    },
    sexta: {
      titulo: `🎯 Sexta-feira: última chance da semana!`,
      corpo: `🎉 Chegou a sexta!\n\nSe você ficou pensando na ${marca} ${modelo} essa semana… hoje é o dia de decidir! Condições especiais para quem fechar até amanhã.\n\nLiga agora e garanta! 📱`,
      hashtags: `#SextaFeira #FecharNegócio #${marca.replace(/ /g, "")} #${modelo} #Oportunidade`,
    },
    mensal_inicio: {
      titulo: `📅 Começo de ${mes} com novidades!`,
      corpo: `Novo mês, novas oportunidades! 🎯\n\nEm ${mes} estamos com:\n✅ Finame/BNDES — taxas especiais\n✅ Demonstração técnica GRATUITA\n✅ Proposta personalizada em 24h\n\nA ${marca} ${modelo} pode ser sua este mês! 📞`,
      hashtags: `#${mes} #${marca.replace(/ /g, "")} #Finame #Promoção #MaquinaPesada`,
    },
    mensal_fim: {
      titulo: `⏰ Últimos dias de ${mes} — não perca!`,
      corpo: `⚠️ ATENÇÃO!\n\nEstamos nos ÚLTIMOS DIAS de ${mes}!\n\nAs condições especiais da ${marca} ${modelo} ENCERRAM em breve:\n🔥 Financiamento facilitado\n🔥 Entrada menor\n🔥 Demonstração na sua obra\n\nMe chama AGORA! ⬇️`,
      hashtags: `#ÚltimosDias #${marca.replace(/ /g, "")} #OfertaEspecial #Urgente #MaquinaPesada`,
    },
    avulso: {
      titulo: `🚜 ${marca} ${modelo} — Potência na sua obra!`,
      corpo: `Conheça a ${marca} ${modelo}! 💪\n\n${curiosidade}.\n\nIdeal para construtoras e empreiteiras que buscam mais produtividade e economia.\n\nSolicite sua proposta hoje! 📲`,
      hashtags: `#${marca.replace(/ /g, "")} #${modelo} #MaquinaPesada #Construção #SulES`,
    },
  };

  return templates[tipo] ?? templates.avulso;
}

// ────────────────────────────────────────────────────────────
// Academia de Vendas — geração de estratégias e abordagem por perfil
// ────────────────────────────────────────────────────────────

const PERFIL_DESC: Record<string, string> = {
  D: "Dominante (decisor direto, foca resultado/ROI, decide rápido, sem paciência para enrolação)",
  I: "Influente (relacional, comunicativo, decide pela emoção e relação, valoriza status e prova social)",
  S: "Estável (cauteloso, evita risco, valoriza segurança, garantia e pós-venda, leal quando confia)",
  C: "Cauteloso-Analítico (técnico, quer dados, especificações e comparativos, decide pela lógica)",
};

// Gera uma estratégia de venda personalizada (em português) para máquinas pesadas.
export async function gerarEstrategiaVendaIA(opts: {
  tema: string;
  perfil?: string | null;
  contexto?: string | null;
}): Promise<{ titulo: string; conteudo: string }> {
  const perfilTxt = opts.perfil ? `\nPerfil do cliente (DISC): ${PERFIL_DESC[opts.perfil] ?? opts.perfil}.` : "";
  const contextoTxt = opts.contexto ? `\nContexto adicional: ${opts.contexto}` : "";

  if (!iaHabilitada()) {
    return {
      titulo: opts.tema,
      conteudo:
        "Configure uma chave de IA (GROQ_API_KEY grátis ou ANTHROPIC_API_KEY) para gerar estratégias personalizadas. Enquanto isso, consulte as metodologias e perfis curados na Academia.",
    };
  }

  try {
    const raw = await llmTexto(
      `Você é um treinador de vendas de elite, especialista em venda consultiva de máquinas pesadas
(linha amarela / construction: escavadeiras, retroescavadeiras, pás-carregadeiras, motoniveladoras
da New Holland Construction e rolos compactadores Dynapac) no Brasil.
Baseie-se nas melhores metodologias do mundo (SPIN Selling, Challenger Sale, Gap Selling, venda
consultiva, princípios de persuasão de Cialdini) e em perfis de personalidade (DISC).
Escreva SEMPRE em português brasileiro, prático, com exemplos reais aplicados a máquinas pesadas.
Devolva SOMENTE um JSON válido: {"titulo": string, "conteudo": string}.
"conteudo": estratégia acionável com passos numerados, frases prontas para usar com o cliente e
exemplos. Use quebras de linha (\\n) e seja específico. Máximo ~1800 caracteres.`,
      `Tema: ${opts.tema}.${perfilTxt}${contextoTxt}`,
      { maxTokens: 1200, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      titulo: parsed.titulo ?? opts.tema,
      conteudo: parsed.conteudo ?? "",
    };
  } catch (e) {
    console.error("Falha ao gerar estratégia:", e);
    return {
      titulo: opts.tema,
      conteudo: "Não foi possível gerar agora. Tente novamente em instantes.",
    };
  }
}

// Sugere o perfil DISC do cliente e a melhor abordagem, a partir das conversas dele.
export async function sugerirAbordagemIA(
  conversas: string[]
): Promise<{ perfil: "D" | "I" | "S" | "C" | null; abordagem: string }> {
  const amostra = conversas.slice(0, 15).join("\n---\n").slice(0, 4000);
  if (!iaHabilitada() || !amostra.trim()) {
    return { perfil: null, abordagem: "Sem conversas suficientes para sugerir um perfil." };
  }
  try {
    const raw = await llmTexto(
      `Você é especialista em perfis de personalidade DISC aplicados a vendas de máquinas pesadas.
Analise as mensagens do cliente e classifique o perfil dele:
D=Dominante (direto, foca resultado), I=Influente (relacional, emotivo),
S=Estável (cauteloso, busca segurança), C=Cauteloso-Analítico (técnico, quer dados).
Devolva SOMENTE JSON: {"perfil": "D"|"I"|"S"|"C", "abordagem": string}.
"abordagem": 2-4 frases em português dizendo COMO o vendedor deve abordar esse cliente
e uma frase de fechamento ideal para o perfil.`,
      `Mensagens do cliente:\n${amostra}`,
      { maxTokens: 500, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const perfil = ["D", "I", "S", "C"].includes(parsed.perfil) ? parsed.perfil : null;
    return { perfil, abordagem: parsed.abordagem ?? "" };
  } catch (e) {
    console.error("Falha ao sugerir abordagem:", e);
    return { perfil: null, abordagem: "Não foi possível analisar agora." };
  }
}

// ────────────────────────────────────────────────────────────
// Prospecção: busca de empresas potenciais em um município
// ────────────────────────────────────────────────────────────

export type ProspectoIA = {
  nome: string;
  tipo: string; // locacao | terraplanagem | engenharia | asfalto | mineracao | construcao
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
};

export async function buscarProspectosIA(
  municipio: string,
  categorias: string[]
): Promise<ProspectoIA[]> {
  const catLista = categorias.join(", ");

  if (!iaHabilitada()) {
    // Sem IA disponível: não há como saber nomes reais de empresas — melhor
    // não sugerir nada do que inventar um nome de empresa fictícia.
    return [];
  }

  try {
    const raw = await llmTexto(
      `Você é um especialista em prospecção de vendas de máquinas pesadas (escavadeiras, retroescavadeiras, pás-carregadeiras, motoniveladoras, rolos compactadores) no sul do Espírito Santo, Brasil.
Seu objetivo: listar empresas REAIS que você efetivamente conhece/tem alta confiança que existam nesse município e possam comprar ou locar máquinas pesadas.
Foque nas categorias solicitadas.
NUNCA invente nomes de empresas que você não tem certeza que existem — isso vira cadastro real no CRM do vendedor
e ele pode tentar contatar uma empresa fictícia. Se não souber nomes reais e específicos para uma categoria, OMITA essa
categoria da lista em vez de inventar um nome plausível.
IMPORTANTE: retorne SOMENTE um JSON válido, array com até 8 objetos (pode ser um array vazio [] se não souber nenhuma empresa real):
[{"nome": string, "tipo": string, "descricao": string, "prioridade": "alta"|"media"|"baixa"}]
"tipo" deve ser um de: locacao, terraplanagem, engenharia, asfalto, mineracao, construcao
"descricao": 1 frase sobre o potencial desta empresa para compra de máquinas
"prioridade": alta=grande frota/obra provável, media=possível, baixa=só prospect`,
      `Município: ${municipio}, ES\nCategorias a prospectar: ${catLista}`,
      { maxTokens: 1200, json: true }
    );

    // Extrai o array JSON da resposta
    const inicio = raw.indexOf("[");
    const fim = raw.lastIndexOf("]");
    if (inicio === -1 || fim === -1) return [];
    const arr = JSON.parse(raw.slice(inicio, fim + 1));
    if (!Array.isArray(arr)) return [];
    return arr.filter((x: any) => x?.nome).map((x: any) => ({
      nome: String(x.nome),
      tipo: String(x.tipo ?? "construcao"),
      descricao: String(x.descricao ?? ""),
      prioridade: (["alta", "media", "baixa"].includes(x.prioridade) ? x.prioridade : "media") as "alta" | "media" | "baixa",
    }));
  } catch (e) {
    console.error("Falha ao buscar prospectos IA:", e);
    return [];
  }
}

export type { ExtracaoConversa };

// ---------- WhatsApp / Agnes ----------

// Classifica a conversa em uma palavra (CLIENTE | LEAD | GRUPO | OUTRO).
export async function classificarConversaIA(amostra: string): Promise<string> {
  if (!iaHabilitada() || !amostra.trim()) return "OUTRO";
  try {
    const r = await llmTexto(
      "Classifique a conversa de WhatsApp em UMA palavra: CLIENTE, LEAD, GRUPO ou OUTRO. Responda só a palavra.",
      amostra.slice(0, 2000),
      { maxTokens: 8 }
    );
    const c = r.trim().toUpperCase().replace(/[^A-Z]/g, "");
    return ["CLIENTE", "LEAD", "GRUPO", "OUTRO"].includes(c) ? c : "OUTRO";
  } catch {
    return "OUTRO";
  }
}

// Gera uma resposta curta para a última mensagem do cliente, no tom do vendedor.
export async function gerarRespostaWhatsAppIA(historico: string, estilo?: string | null): Promise<string> {
  if (!iaHabilitada() || !historico.trim()) return "";
  try {
    return (await llmTexto(
      `Você é o assistente de um vendedor de máquinas pesadas (New Holland Construction / Dynapac, sul do ES).
Responda a ÚLTIMA mensagem do cliente de forma curta, cordial e útil, no tom do vendedor.
NUNCA invente preços ou prazos. Se faltar info, peça educadamente.
REGRA OBRIGATÓRIA: NÃO use emojis de nenhum tipo. A resposta deve ser texto puro, natural e humano.${estilo ? `\nEstilo do vendedor: ${estilo}` : ""}`,
      historico.slice(-4000),
      { maxTokens: 400 }
    )).trim();
  } catch {
    return "";
  }
}
