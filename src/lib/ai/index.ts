import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { extrairHeuristica, type ExtracaoConversa } from "./heuristics";
import { agoraBrasiliaExtenso, saudacaoBrasilia } from "@/lib/utils";
import { MODEL_TAREFA, OPENAI_MODEL, GEMINI_MODEL, GEMINI_API_BASE, DEEPSEEK_MODEL } from "./config";
import { sugerirProximaAcaoHeuristica, type SinaisProximaAcao } from "@/lib/zeus/nextbestaction";
import { lerParametros } from "@/lib/parametros";
import { modeloGroq, erroDeModeloGroq, marcarModeloGroqRuim, parametrosGroq, erroDeJsonGroq, erroDeCotaGroq, marcarModeloGroqEsgotado, CANDIDATOS_GROQ, GROQ_BASE_URL } from "./groq";
import { esperaDoLimite } from "./cota";
import { diagnosticoIA, type DiagnosticoIA, type ProvedorId } from "./provedores-status";
export type { SinaisProximaAcao };

const MODEL = MODEL_TAREFA;

// Provedores de IA disponíveis, em ordem de preferência: Gemini > Groq >
// DeepSeek > OpenAI > Anthropic. Ordem pensada pra custo mínimo — Gemini e
// Groq têm camada gratuita de verdade (o suficiente pro volume de um único
// vendedor), DeepSeek é o mais barato entre os pagos, OpenAI vem em seguida
// e a Anthropic (a mais cara) fica só como último recurso. Manter vários
// provedores configurados ao mesmo tempo é opcional, mas recomendado: se o
// primeiro falhar (limite do plano grátis, sem crédito, instabilidade),
// llmTexto tenta AUTOMATICAMENTE o próximo da lista.
type ProvedorTexto = "gemini" | "groq" | "deepseek" | "openai" | "anthropic";

function provedoresDisponiveis(): ProvedorTexto[] {
  const lista: ProvedorTexto[] = [];
  if (process.env.GEMINI_API_KEY) lista.push("gemini");
  if (process.env.GROQ_API_KEY) lista.push("groq");
  if (process.env.DEEPSEEK_API_KEY) lista.push("deepseek");
  if (process.env.OPENAI_API_KEY) lista.push("openai");
  if (process.env.ANTHROPIC_API_KEY) lista.push("anthropic");
  return lista;
}

function provedorIA(): ProvedorTexto | null {
  return provedoresDisponiveis()[0] ?? null;
}

export function iaHabilitada() {
  return provedorIA() !== null;
}

// Há provedor que lê imagem/PDF (ver llmVisao)?
export function visaoHabilitada() {
  return !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/**
 * A situação dos provedores, para a tela do ZEUS mostrar.
 *
 * Só esta função lê as variáveis de ambiente; a interpretação fica no módulo
 * puro provedores-status.ts, que tem teste. Nenhuma chave é exposta — só o
 * fato de estar ou não configurada.
 */
export function diagnosticoDaIA(): DiagnosticoIA {
  return diagnosticoIA(provedoresDisponiveis() as ProvedorId[]);
}

// Nome amigável do provedor de IA ativo (para exibir na interface).
export function provedorIANome(): string | null {
  const p = provedorIA();
  if (p === "gemini") return "Google Gemini";
  if (p === "groq") return "Groq (grátis)";
  if (p === "deepseek") return "DeepSeek";
  if (p === "openai") return "OpenAI";
  if (p === "anthropic") return "Anthropic";
  return null;
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function openaiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// DeepSeek expõe uma API compatível com o formato da OpenAI — reaproveita o
// mesmo SDK, só trocando a URL base e a chave.
function deepseekClient() {
  return new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
}

// Gemini usa um formato de API próprio (REST, sem SDK) — chamada direta via fetch.
async function gemini(system: string, user: string, opts?: { maxTokens?: number; json?: boolean; raciocinio?: boolean }): Promise<string> {
  const res = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: (opts?.maxTokens ?? 1024) + (opts?.raciocinio ? 2048 : 0),
          ...(opts?.json ? { responseMimeType: "application/json" } : {}),
          // Raciocínio antes de responder (Gemini 2.5): melhora muito análise
          // de conversa e extração; custa alguns segundos a mais.
          ...(opts?.raciocinio ? { thinkingConfig: { thinkingBudget: 2048 } } : {}),
        },
      }),
    }
  );
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha no Gemini (${res.status}): ${detalhe.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

// Executa a chamada de texto num provedor específico — corpo de cada branch
// extraído de llmTexto para permitir a cascata de fallback abaixo.
async function chamarProvedorTexto(
  prov: ProvedorTexto,
  system: string,
  user: string,
  opts?: { maxTokens?: number; json?: boolean; raciocinio?: boolean }
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? 1024;

  if (prov === "gemini") {
    return gemini(system, user, opts);
  }

  if (prov === "openai") {
    const resp = await openaiClient().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return resp.choices[0]?.message?.content ?? "";
  }

  if (prov === "deepseek") {
    const resp = await deepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: maxTokens,
      ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return resp.choices[0]?.message?.content ?? "";
  }

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

  // groq — modelo escolhido automaticamente (ver ./groq.ts). Se o Groq disser
  // que o modelo não existe mais, marca como ruim e refaz com o próximo; se o
  // JSON estrito falhar, refaz pedindo o JSON só pelo prompt.
  // O teto era 5, com NOVE modelos candidatos: numa rajada em que os modelos
  // estouram a cota um a um, cada troca gastava uma tentativa e a chamada
  // morria em "nenhum modelo disponível" com QUATRO modelos ainda com cota
  // própria intactos. O teto agora cobre a lista inteira, com folga para as
  // duas refeições que não trocam de modelo (JSON estrito e modelo ruim).
  let semFormato = false;
  const MAX_TENTATIVAS = CANDIDATOS_GROQ.length + 3;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const modelo = await modeloGroq();
    const sistema = opts?.json && semFormato ? `${system}\n\nResponda SOMENTE com um JSON válido, sem texto antes ou depois, sem markdown.` : system;
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...parametrosGroq(modelo, maxTokens, !!opts?.json, semFormato),
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      if (res.status === 404 && erroDeModeloGroq(detalhe)) { marcarModeloGroqRuim(modelo); continue; }
      // Cota do Groq é por modelo: este esgotou (tokens/dia ou /min), o próximo
      // candidato ainda tem a dele — troca e refaz em vez de falhar.
      // A espera sai do que o PRÓPRIO Groq informou ("try again in 8.5s"), e
      // não de uma hora fixa: limite por minuto volta em segundos, e congelar
      // o modelo por uma hora jogava fora cota que já tinha voltado.
      if (res.status === 429 && erroDeCotaGroq(detalhe)) { marcarModeloGroqEsgotado(modelo, Date.now(), esperaDoLimite(detalhe)); continue; }
      if (res.status === 400 && opts?.json && !semFormato && erroDeJsonGroq(detalhe)) { semFormato = true; continue; }
      throw new Error(`Falha no Groq (${res.status}, ${modelo}): ${detalhe.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const conteudo = data.choices?.[0]?.message?.content ?? "";
    // Sem formato estrito o modelo pode cercar o JSON com ```json … ``` — limpa.
    return opts?.json ? conteudo.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim() : conteudo;
  }
  throw new Error("Groq: nenhum modelo disponível.");
}

// Chamada unificada de LLM com FALLBACK REAL de provedor: tenta cada provedor
// configurado na ordem de preferência e, se um falhar (429 do plano grátis,
// sem crédito, instabilidade), passa pro próximo automaticamente — só lança
// erro se TODOS falharem. Exportada para uso fora deste arquivo (ex:
// Orientador de Vendas em lib/zeus/orientador.ts).
export async function llmTexto(
  system: string,
  user: string,
  opts?: { maxTokens?: number; json?: boolean; raciocinio?: boolean }
): Promise<string> {
  const provs = provedoresDisponiveis();
  if (!provs.length) throw new Error("Nenhum provedor de IA configurado.");

  let ultimoErro: unknown = null;
  for (const prov of provs) {
    try {
      return await chamarProvedorTexto(prov, system, user, opts);
    } catch (e) {
      ultimoErro = e;
      console.error(`[llmTexto] provedor ${prov} falhou, tentando o próximo:`, e instanceof Error ? e.message : e);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

// Executa a chamada com visão num provedor específico — corpo extraído de
// llmVisao para permitir a cascata de fallback abaixo.
async function chamarProvedorVisao(
  prov: "gemini" | "openai" | "anthropic",
  system: string,
  textoUser: string,
  arquivo: { base64: string; mediaType: string },
  opts?: { maxTokens?: number; json?: boolean }
): Promise<string> {
  if (prov === "gemini") {
    const res = await fetch(
      `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: arquivo.mediaType, data: arquivo.base64 } },
              { text: textoUser },
            ],
          }],
          generationConfig: {
            maxOutputTokens: opts?.maxTokens ?? 1500,
            ...(opts?.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    );
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error(`Falha no Gemini (${res.status}): ${detalhe.slice(0, 200)}`);
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  }

  if (prov === "openai") {
    const resp = await openaiClient().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: opts?.maxTokens ?? 1500,
      ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${arquivo.mediaType};base64,${arquivo.base64}` } },
            { type: "text", text: textoUser },
          ],
        },
      ],
    });
    return resp.choices[0]?.message?.content ?? "";
  }

  // anthropic
  const bloco = arquivo.mediaType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: arquivo.base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: arquivo.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: arquivo.base64 } };
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: opts?.maxTokens ?? 1500,
    system,
    messages: [{ role: "user", content: [bloco, { type: "text" as const, text: textoUser }] as Anthropic.MessageParam["content"] }],
  });
  return resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}

// Chamada unificada com VISÃO (lê PDF/imagem) — usada por extrairFichaDeArquivoIA
// e pelo post de marketing a partir de foto. Ordem de preferência: Gemini >
// OpenAI (gpt-4o-mini também lê imagem/PDF nativamente) > Anthropic. Groq e
// DeepSeek não entram aqui (sem suporte a visão nesse tipo de chamada).
// Mesmo fallback automático de llmTexto: se um provedor falhar, tenta o próximo.
async function llmVisao(
  system: string,
  textoUser: string,
  arquivo: { base64: string; mediaType: string },
  opts?: { maxTokens?: number; json?: boolean }
): Promise<string> {
  const provs: ("gemini" | "openai" | "anthropic")[] = [];
  if (process.env.GEMINI_API_KEY) provs.push("gemini");
  if (process.env.OPENAI_API_KEY) provs.push("openai");
  if (process.env.ANTHROPIC_API_KEY) provs.push("anthropic");
  if (!provs.length) {
    throw new Error("Nenhum provedor com leitura de PDF/imagem configurado (GEMINI_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY).");
  }

  let ultimoErro: unknown = null;
  for (const prov of provs) {
    try {
      return await chamarProvedorVisao(prov, system, textoUser, arquivo, opts);
    } catch (e) {
      ultimoErro = e;
      console.error(`[llmVisao] provedor ${prov} falhou, tentando o próximo:`, e instanceof Error ? e.message : e);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

// Documento que o cliente mandou no WhatsApp (CNH, RG, contrato, proposta…):
// de quem é e quando nasceu — para registrar o aniversário no cadastro. Foto
// que não é documento (máquina, obra, print) volta tudo null.
export type DadosDocumento = { ehDocumento: boolean; tipoDocumento: string | null; nome: string | null; dataNascimento: string | null };

export async function extrairDadosDocumentoIA(arquivo: { base64: string; mediaType: string }): Promise<DadosDocumento> {
  const vazio: DadosDocumento = { ehDocumento: false, tipoDocumento: null, nome: null, dataNascimento: null };
  const system = `Você lê documentos brasileiros enviados por WhatsApp: CNH, RG, CPF, contrato, proposta, nota fiscal, comprovante.
Devolva SOMENTE um JSON válido, sem texto fora dele:
{
  "ehDocumento": boolean,          // true se o arquivo é um documento com dados de uma pessoa
  "tipoDocumento": "CNH"|"RG"|"CPF"|"contrato"|"proposta"|"nota fiscal"|"outro"|null,
  "nome": string|null,             // nome completo da pessoa titular, exatamente como está escrito
  "dataNascimento": "AAAA-MM-DD"|null // data de NASCIMENTO da pessoa — nunca data de emissão, validade ou do contrato
}
Se for foto de máquina, obra, print de conversa ou qualquer coisa que não seja documento: {"ehDocumento": false, "tipoDocumento": null, "nome": null, "dataNascimento": null}.
Nunca invente: campo que não está legível no documento é null.`;
  const raw = await llmVisao(system, "Leia o documento e devolva o JSON.", arquivo, { maxTokens: 300, json: true });
  const ini = raw.indexOf("{"), fim = raw.lastIndexOf("}");
  if (ini === -1 || fim === -1) return vazio;
  const p = JSON.parse(raw.slice(ini, fim + 1)) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { ehDocumento: p.ehDocumento === true, tipoDocumento: s(p.tipoDocumento), nome: s(p.nome), dataNascimento: s(p.dataNascimento) };
}

const schemaInstrucao = (marcas: string, regiao: string) => `Você é o cérebro de um CRM de um vendedor de máquinas pesadas da LINHA AMARELA / CONSTRUCTION
(${marcas}) no ${regiao}. O vendedor NÃO trabalha com máquinas
agrícolas nem tratores (não existe T7, TL, colheitadeira, etc. no portfólio dele).
Os equipamentos são: escavadeiras (ex: E215C), retroescavadeiras (ex: B95C), pás-carregadeiras (ex: W190B),
motoniveladoras (ex: RG170) e a linha Dynapac de compactação e pavimentação: rolos de solo (ex: CA25 D, CA65 PD),
rolos tandem de asfalto (ex: CC2200 VI), rolos pneumáticos (ex: CP2100), vibroacabadoras (ex: SD2500CS),
fresadoras (ex: PL2000S) e o rolo de vala LP6500.

Analise a conversa com um cliente e devolva SOMENTE um JSON válido, sem texto antes ou depois, com as chaves:
{
  "resumo": string,                       // 1-2 frases do que aconteceu
  "perfil": string,                       // perfil do cliente (construtora, empreiteira, locadora, prefeitura, etc.)
  "nomeCliente": string|null,             // nome do cliente, se identificável na conversa
  "telefoneCliente": string|null,         // telefone do cliente (só dígitos), se aparecer
  "municipio": string|null,               // cidade do cliente, SOMENTE se ela for dita de verdade na conversa. É uma cidade do ESPÍRITO SANTO (ex: "Guaçuí", "Cachoeiro de Itapemirim", "Vila Velha"). Se a cidade que você tem não é do ES, é erro de leitura: devolva null. Nunca deduza cidade por DDD, sotaque ou nome de pessoa.
  "maquina": string|null,                 // modelo SOMENTE se o cliente mencionar explicitamente (ex: "E215C", "B95C", "CA25 D"). NUNCA invente um modelo. Se nada for citado, use null.
  "valor": number|null,                   // valor em reais (número puro)
  "condicaoPagamento": "avista"|"consorcio"|"financiamento"|"crd_pme"|null,  // financiamento = banco/Finame/BNDES; crd_pme = parcelado pela própria casa. Se não estiver dito, null — não existe "outro" aqui.
  "concorrente": string|null,             // concorrente citado (Caterpillar, Komatsu, Volvo, JCB, Case, XCMG, Sany...)
  "dataVisita": string|null,              // ISO 8601 do dia/hora de uma VISITA PRESENCIAL (vendedor vai ao cliente/obra, ou cliente vem à loja). NÃO é visita: "amanhã te dou uma posição", "amanhã falo com meu sócio", "te ligo amanhã", "semana que vem a gente vê" — nesses casos null
  "visitaConfirmada": boolean,            // true SÓ se os DOIS lados combinaram a visita presencial num dia ("fechado, quinta 14h na obra" / "te espero terça"). Proposta de um lado ainda sem resposta, "vou ver", "se der" = false
  "sentimento": "positivo"|"neutro"|"negativo",
  "ehProspectReal": boolean,              // realmente negociou/pediu info de máquina?
  "intencao": "comprar"|"cotar"|"curiosidade"|"suporte"|"outro", // comprar = quer fechar/financiar; cotar = pediu preço/proposta; curiosidade = só perguntou; suporte = peça/garantia/assistência
  "categoriaMaquina": string|null,        // retroescavadeira | escavadeira | pá carregadeira | mini escavadeira | mini carregadeira | motoniveladora | rolo compactador — pelo nome comum, mesmo sem modelo: "retro" = retroescavadeira; "pá" = pá carregadeira; "patrol"/"motoniveladora" = motoniveladora; "mini" = mini escavadeira ou mini carregadeira conforme o contexto; "rolo" = rolo compactador
  "valorConcorrente": number|null,        // preço que o cliente disse ter recebido de um CONCORRENTE (nunca vai em "valor")
  "rascunhoResposta": string              // resposta sugerida no tom do vendedor
}
REGRAS CRÍTICAS:
- "maquina" só pode ser preenchido com um modelo que o cliente realmente citou na conversa. Se não citar, DEVE ser null. Jamais use um modelo padrão/exemplo.
- "valor" é o valor da NOSSA negociação (proposta nossa, orçamento pedido, quanto o cliente quer pagar). Preço de concorrente vai em "valorConcorrente". Se não houver valor nosso, "valor" é null.
- A conversa vem em ordem cronológica; analise a ÚLTIMA mensagem do cliente à luz das anteriores (ex.: "quinta 14h pode ser" só faz sentido com a pergunta anterior). Não repita dados já resolvidos como se fossem novos.
- "municipio" e "condicaoPagamento" vão direto para o cadastro do cliente e para a ficha da negociação. Na dúvida, null: um campo vazio é honesto, um campo chutado vira erro que ninguém vê. Já aconteceu de um cliente de Guaçuí ser gravado como de Recife por causa de um chute aqui.`;

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
  const p = await lerParametros();

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
    const raw = await llmTexto(schemaInstrucao(p.marcas, p.regiao) + contextoData + modelos + tom, `Conversa:\n${texto}`, {
      maxTokens: 1024,
      json: true,
      raciocinio: true,
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
      visitaConfirmada: parsed.visitaConfirmada === true,
      sentimento: parsed.sentimento ?? "neutro",
      ehProspectReal: !!parsed.ehProspectReal,
      rascunhoResposta: parsed.rascunhoResposta ?? "",
      fonte: "ia",
      valorConcorrente: typeof parsed.valorConcorrente === "number" ? parsed.valorConcorrente : null,
      intencao: ["comprar", "cotar", "curiosidade", "suporte", "outro"].includes(parsed.intencao) ? parsed.intencao : "outro",
      categoriaMaquina: typeof parsed.categoriaMaquina === "string" && parsed.categoriaMaquina.trim() ? parsed.categoriaMaquina.trim().toLowerCase() : null,
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
  const p = await lerParametros();
  const texto = thread.trim();
  if (!texto) return "Sem mensagens nesta conversa.";
  if (!iaHabilitada()) {
    // Fallback: usa as últimas linhas da conversa como resumo bruto.
    const linhas = texto.split("\n").filter((l) => l.trim()).slice(-6);
    return linhas.join("\n");
  }
  try {
    return await llmTexto(
      `Você é um gerente comercial revisando, para um relatório, o histórico de WhatsApp de um vendedor de máquinas
pesadas (${p.marcas}, ${p.regiao}). Escreva um resumo COMPLETO e substancial de tudo que foi conversado e
negociado nesta conversa — não um teaser de 2 linhas. Em parágrafos corridos (não uma lista solta de bullets),
cubra o que houver de fato na conversa:
- Quem é o cliente e o que ele precisa (aplicação, urgência, contexto do negócio dele)
- Máquina(s)/modelo(s) e valores discutidos, e como evoluíram ao longo da conversa
- Forma de pagamento (à vista, financiamento, consórcio, banco) e o que já foi tratado sobre isso
- Concorrente(s) citado(s) e o que foi dito sobre eles
- Visitas marcadas ou realizadas, propostas enviadas, documentos pedidos
- Objeções levantadas e como foram tratadas
- O que já ficou combinado e o que ainda está pendente, e de quem é a pendência
- Em que ponto a negociação está agora e qual seria o próximo passo
Seja completo mas direto: não repita a mesma informação duas vezes, não infle o texto à toa, e não invente nada
que não esteja na conversa. Se pouca coisa aconteceu (ex.: só uma saudação), diga isso em 1-2 frases em vez de
forçar todos os tópicos.`,
      `Conversa:\n${texto}`,
      { maxTokens: 900 }
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
  const p = await lerParametros();
  if (!iaHabilitada()) {
    return { resposta: "A IA não está configurada (defina GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY).", acoes: [] };
  }
  const agora = opts?.base ?? new Date();
  const system = `Você é o Assistente IA de um CRM de um vendedor de máquinas pesadas (${p.marcas}, ${p.regiao}) — tão capaz quanto o Cérebro do CRM. Você entende qualquer pedido relacionado a clientes, negociações, visitas e tarefas, e converte em ações estruturadas. Nunca diga que "não pode" ou que é limitado — se o pedido corresponder a um dos tipos de ação abaixo, execute-o com confiança; se não corresponder a nenhum, explique em "resposta" o que você consegue fazer hoje.
Responda SOMENTE com JSON válido, sem texto fora do JSON:
{
  "resposta": string,   // fala curta e confiante confirmando o que entendeu
  "acoes": []           // lista de ações (vazia se não entendeu)
}
Tipos de ação válidos (use exatamente estes valores em "tipo"):
- {"tipo":"criar_cliente","nome":string,"telefone"?:string,"municipio"?:string,"observacoes"?:string,"interesseFuturo"?:boolean,"interesseFuturoData"?:"YYYY-MM-DD","interesseFuturoNota"?:string}
- {"tipo":"editar_cliente","cliente":string,"telefone"?:string,"municipio"?:string,"observacoes"?:string,"jaComprou"?:boolean,"visitado"?:boolean,"interesseFuturo"?:boolean,"interesseFuturoData"?:"YYYY-MM-DD","interesseFuturoNota"?:string}
- {"tipo":"editar_resumo","cliente":string,"resumoMaquinas"?:string,"resumoTexto"?:string,"resumoValor"?:number,"resumoCondicao"?:"pesquisando"|"interesse_futuro"|"avista"|"financiamento"|"consorcio","proximaVisita"?:"YYYY-MM-DD","proximaVisitaNota"?:string}
- {"tipo":"criar_card","cliente":string,"estagio"?:string,"maquina"?:string,"valor"?:number}
- {"tipo":"mover_negociacao","cliente":string,"estagio":string}
- {"tipo":"marcar_venda_ganha","cliente":string}
- {"tipo":"marcar_venda_perdida","cliente":string,"motivo"?:string}
- {"tipo":"criar_tarefa","titulo":string,"descricao"?:string,"coluna"?:string}
- {"tipo":"agendar_visita","cliente":string,"data":"YYYY-MM-DD","observacao"?:string}
Regras:
- "cliente" = nome APROXIMADO do cliente como o vendedor falou (o sistema buscará por nome similar no cadastro, tolerando erros de digitação).
- Use "editar_resumo" quando o vendedor mencionar: histórico, compra, valor pago, máquina que o cliente tem, resumo do atendimento, situação do cliente, o que foi conversado, intenção de compra, próxima visita.
- "criar_card"/"mover_negociacao" = funil de negociação. Estágios válidos: "primeiro_contato","visita_pendente","visita_realizada","proposta_bcnh","proposta_aprovada". Se não souber, omita.
- "marcar_venda_ganha"/"marcar_venda_perdida" = fecha a negociação ABERTA mais recente do cliente como faturada/perdida.
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

const SEGMENTOS_APLICACAO = [
  "Construção civil e infraestrutura", "Terraplenagem e movimentação de terra", "Agricultura e agronegócio",
  "Mineração e brita", "Saneamento, drenagem e obras hídricas", "Pavimentação e conservação de estradas",
  "Prefeituras e obras públicas", "Locação (aluguel) para terceiros", "Paisagismo e obras de grande porte",
  "Logística, portos e pátios industriais", "Florestal e limpeza de área", "Gestão de resíduos e aterros",
];

// Setor de Aplicações & Nichos (item pedido pelo usuário): para uma máquina
// PRÓPRIA (New Holland/Dynapac), lista TODOS os segmentos de mercado e
// operações reais onde ela se aplica — objetivo é ajudar o vendedor a
// enxergar nichos de cliente que ele ainda não está prospectando. Diferente
// da ficha técnica: aqui pode usar conhecimento geral de mercado do setor
// (não exige que o dado já esteja cadastrado), mas sem inventar números.
export async function gerarAplicacoesMaquinaIA(maquina: {
  marca: string;
  modelo: string;
  categoria: string;
  descricao?: string | null;
  especificacoes?: string | null;
  pontosFortes?: string | null;
  diferenciais?: string | null;
}): Promise<string> {
  if (!iaHabilitada()) return "";
  try {
    return await llmTexto(
      `Você é um consultor sênior de inteligência de mercado para máquinas pesadas do ramo construction (linha
amarela) no Brasil, redigindo um DOSSIÊ TÉCNICO-COMERCIAL para o time comercial de uma concessionária —
o tom é o de um relatório profissional de consultoria (objetivo, denso em informação, zero enrolação),
não uma lista solta de ideias. Você tem profundo conhecimento de TODOS os setores que usam esse tipo de
equipamento — não só os óbvios.
Segmentos possíveis a considerar (use somente os que realmente fazem sentido para a categoria da máquina,
não force um segmento onde ela não se aplica): ${SEGMENTOS_APLICACAO.join("; ")}.

Para a máquina informada, mapeie TODOS os segmentos de mercado onde ela é realmente útil. Baseie-se em como
esse tipo de máquina é usado de fato no mercado brasileiro — pode usar seu conhecimento geral do setor, mas
NUNCA invente números técnicos ou dados que não foram informados.

Formato exato (markdown, sem preâmbulo, sem repetir o nome da máquina no topo):

## Resumo executivo
Um parágrafo (3-4 frases) posicionando a máquina no mercado: para que perfil de operação ela é mais
competitiva, seu principal diferencial de venda, e o potencial geral de expansão de carteira que ela oferece.

## [Nome do segmento 1]
- **Aplicação:** operação/tarefa concreta que a máquina realiza nesse segmento (seja específico, nunca genérico)
- **Diferencial competitivo:** por que ESSA máquina (e não uma concorrente) se encaixa aqui — cite um
  diferencial real do cadastro quando houver, ou uma característica técnica plausível da categoria
(repita o bloco "## [Nome do segmento]" com as 2 linhas acima para cada segmento aplicável — normalmente 4 a 7 segmentos)

## Nichos pouco explorados
- **[Tipo de cliente/segmento]:** por que esse nicho é uma oportunidade de expansão de carteira ainda pouco prospectada
(2-4 itens)`,
      `Máquina: ${maquina.marca} ${maquina.modelo} (categoria: ${maquina.categoria}).
${maquina.descricao ? `Descrição: ${maquina.descricao}` : ""}
${maquina.especificacoes ? `Especificações:\n${maquina.especificacoes}` : ""}
${maquina.pontosFortes ? `Pontos fortes: ${maquina.pontosFortes}` : ""}
${maquina.diferenciais ? `Diferenciais: ${maquina.diferenciais}` : ""}`,
      { maxTokens: 1700 }
    );
  } catch (err) {
    console.error("Falha ao gerar aplicações da máquina:", err);
    return "";
  }
}

// Setor de Pós-venda: sugere ações concretas para manter presença junto a um
// cliente que já comprou — nunca inventa dado (máquina, datas) que não esteja
// no contexto fornecido. Quando o cliente está num marco de acompanhamento
// (30/60/180/365 dias desde o faturamento) ainda não registrado, prioriza
// gerar a MENSAGEM PRONTA daquele marco em vez de ideias genéricas.
export async function gerarIdeiasPosVendaIA(contexto: {
  nomeCliente: string;
  maquina: string | null;
  dataCompra: string | null;
  diasDesdeCompra: number | null;
  diasDesdeUltimoContato: number | null;
  historicoContatos: string[];
  observacoes: string | null;
  marcoPendente: string | null;
}): Promise<string> {
  if (!iaHabilitada()) return "";
  try {
    const instrucaoMarco = contexto.marcoPendente
      ? `Este cliente atingiu o marco de acompanhamento de ${contexto.marcoPendente} desde o faturamento da máquina — isso é
PRIORIDADE. Comece a resposta com a linha "Mensagem pronta para enviar agora (marco de ${contexto.marcoPendente}):" seguida,
na linha de baixo, do rascunho de uma mensagem de WhatsApp (entre aspas) natural e pessoal — cite o nome do cliente e a
máquina, sem parecer automática ou robótica — adequada a este momento específico do ciclo pós-venda:
- 30 dias: checar adaptação à máquina, horas de uso, dúvidas de operação, lembrete da primeira manutenção
- 60 dias: satisfação geral com a máquina, oferecer peças de desgaste/consumíveis
- 6 meses: lembrete de revisão preventiva
- 1 ano: comemorar o aniversário da compra e sondar necessidade de nova máquina/implemento
Depois dessa mensagem, pule uma linha e escreva "Outras ações:" seguido de 2-3 ações adicionais em lista.`
      : `Sugira de 3 a 5 ações CONCRETAS e específicas para este cliente agora, considerando a máquina comprada, há quanto
tempo, e o histórico de contatos já feitos (não repita algo que já foi feito recentemente).`;

    return await llmTexto(
      `Você é especialista em pós-venda e retenção de clientes de máquinas pesadas (New Holland Construction / Dynapac) no Brasil.
Seu objetivo é manter o vendedor SEMPRE PRESENTE na vida do cliente depois da venda — não deixar o relacionamento esfriar.
${instrucaoMarco}
Tipos de ação possíveis: ligação de satisfação, oferta de revisão/manutenção preventiva, venda de peças/consumíveis,
convite para trazer a máquina numa ação da concessionária, pedido de indicação de outro cliente da região, verificação
de necessidade de implemento ou máquina adicional, aniversário da compra.
NUNCA invente dados (prazos de garantia, preços, datas) que não estejam no contexto.
Responda em português, direto ao ponto, sem markdown (##, **) e sem introdução além do pedido acima.`,
      `Cliente: ${contexto.nomeCliente}
Máquina comprada: ${contexto.maquina ?? "não informado"}
Data do faturamento: ${contexto.dataCompra ?? "não informada"}${contexto.diasDesdeCompra != null ? ` (${contexto.diasDesdeCompra} dias atrás)` : ""}
Último contato (WhatsApp ou registro manual): ${contexto.diasDesdeUltimoContato != null ? `${contexto.diasDesdeUltimoContato} dias atrás` : "nenhum registrado ainda"}
${contexto.historicoContatos.length ? `Histórico de contatos pós-venda:\n${contexto.historicoContatos.join("\n")}` : "Sem histórico de contato pós-venda registrado."}
${contexto.observacoes ? `Observações do cliente: ${contexto.observacoes}` : ""}`,
      { maxTokens: 700 }
    );
  } catch (err) {
    console.error("Falha ao gerar ideias de pós-venda:", err);
    return "";
  }
}

// Extrai a ficha técnica de um ARQUIVO anexado (PDF ou imagem do catálogo).
// PDF/imagem exigem um provedor com visão (Gemini, OpenAI ou Anthropic — ver
// llmVisao). O arquivo NÃO é guardado — só o conteúdo extraído.
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

  // PDF/imagem exigem um provedor com visão.
  if (!ehTexto && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, erro: "A leitura de PDF/imagem exige GEMINI_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY." };
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
    // Checa iaHabilitada() ANTES de chamar llmTexto: sem nenhum provedor
    // configurado, llmTexto lança erro (não retorna vazio), e cairia no catch
    // genérico abaixo — escondendo a mensagem clara de "configure uma chave".
    if (ehTexto) {
      if (!iaHabilitada()) return { ok: false, erro: "IA não habilitada. Configure GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY." };
      const raw = await llmTexto(system, `Conteúdo do arquivo:\n\n${arquivo.texto}`, { maxTokens: 1500, json: true });
      return finalizar(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    }

    // Caminho de PDF/IMAGEM — via llmVisao (Gemini > OpenAI > Anthropic).
    const raw = await llmVisao(
      system,
      `Extraia a ficha técnica da ${maquina.marca} ${maquina.modelo} (${maquina.categoria}).`,
      { base64: arquivo.base64!, mediaType: arquivo.mediaType! },
      { maxTokens: 1500, json: true }
    );
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
  const p = await lerParametros();
  if (!iaHabilitada()) return "";
  try {
    return await llmTexto(
      `Você é consultor de vendas de máquinas pesadas (${p.marcas}) no ${p.regiao}.
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

// Ficha de uma máquina, para os prompts do Comparativo 2.0.
type FichaMaquina = {
  marca: string;
  modelo: string;
  especificacoes?: string | null;
  pontosFortes?: string | null;
  diferenciais?: string | null;
  argumentos?: string | null;
};

// Resumo de diferenciais COM benefício prático (Comparativo 2.0, item J.3):
// para cada diferencial real da minha máquina, explica o benefício e a
// melhor aplicação — nunca inventa specs, só usa o que está no banco/notas.
export async function gerarResumoDiferenciaisIA(
  minha: FichaMaquina,
  concorrentes: { marca: string; modelo: string; especificacoes?: string | null }[],
  notas: string[]
): Promise<string> {
  const p = await lerParametros();
  if (!iaHabilitada()) return "";
  try {
    return await llmTexto(
      `Você é consultor de vendas de máquinas pesadas ${p.marcas} no ${p.regiao}.
Para cada diferencial REAL da MINHA máquina frente aos concorrentes listados, explique o BENEFÍCIO PRÁTICO e a melhor aplicação —
use SOMENTE os dados fornecidos (especificações, pontos fortes, diferenciais, argumentos e notas do vendedor).
Formato: bullets curtos "Diferencial → benefício prático (melhor aplicação)". Ex.: "Tanque maior → mais horas de trabalho sem parar para reabastecer".
NUNCA invente números ou recursos que não estejam nos dados — se não houver dado suficiente para sustentar um diferencial, não o cite.
Máximo 6 bullets, direto ao ponto, sem enrolação, sem títulos.`,
      `MINHA MÁQUINA: ${minha.marca} ${minha.modelo}
Especificações: ${minha.especificacoes ?? "—"}
Pontos fortes: ${minha.pontosFortes ?? "—"}
Diferenciais: ${minha.diferenciais ?? "—"}
Argumentos de negociação: ${minha.argumentos ?? "—"}
${notas.length ? `Notas do vendedor sobre esta máquina:\n${notas.join("\n")}` : ""}

CONCORRENTES SELECIONADOS:
${concorrentes.map((c) => `${c.marca} ${c.modelo}: ${c.especificacoes ?? "(ficha não preenchida)"}`).join("\n\n")}`,
      { maxTokens: 700 }
    );
  } catch (err) {
    console.error("Falha ao gerar resumo de diferenciais:", err);
    return "";
  }
}

// Comparativo profissional completo multi-concorrente (Comparativo 2.0, item
// J.5) — evolução do battlecard: tabela de specs, pontos fortes com
// benefício, respostas a objeções prováveis e conclusão. Nunca inventa specs.
export async function gerarComparativoCompletoIA(
  minha: FichaMaquina,
  concorrentes: { marca: string; modelo: string; especificacoes?: string | null }[],
  notas: string[]
): Promise<string> {
  const p = await lerParametros();
  if (!iaHabilitada()) return "";
  try {
    return await llmTexto(
      `Você é consultor sênior de vendas de máquinas pesadas ${p.marcas} no ${p.regiao}.
Escreva um COMPARATIVO PROFISSIONAL COMPLETO da minha máquina contra os concorrentes selecionados, para o vendedor apresentar/imprimir ao cliente.
Use SOMENTE os dados fornecidos (especificações, pontos fortes, diferenciais, argumentos, notas do vendedor) — NUNCA invente números ou recursos.
Estruture em markdown com estes títulos, nesta ordem:
**Tabela comparativa** — tabela markdown com as especificações disponíveis de todas as máquinas (linhas = atributos, colunas = máquinas). Só inclua atributos com dado em pelo menos uma máquina.
**Pontos fortes com benefício** — para cada diferencial real, o benefício prático e a melhor aplicação.
**Respostas às objeções prováveis** — 2-4 objeções que o cliente pode levantar (preço, marca do concorrente, disponibilidade) com a resposta pronta.
**Por que New Holland/Dynapac é a melhor compra** — conclusão de 3-4 frases fechando a venda.
Linguagem direta, confiante, do dia a dia da obra.`,
      `MINHA MÁQUINA: ${minha.marca} ${minha.modelo}
Especificações: ${minha.especificacoes ?? "—"}
Pontos fortes: ${minha.pontosFortes ?? "—"}
Diferenciais: ${minha.diferenciais ?? "—"}
Argumentos de negociação: ${minha.argumentos ?? "—"}
${notas.length ? `Notas do vendedor sobre esta máquina:\n${notas.join("\n")}` : ""}

CONCORRENTES SELECIONADOS:
${concorrentes.map((c) => `${c.marca} ${c.modelo}: ${c.especificacoes ?? "(ficha não preenchida)"}`).join("\n\n")}`,
      { maxTokens: 1800 }
    );
  } catch (err) {
    console.error("Falha ao gerar comparativo completo:", err);
    return "";
  }
}

// ────────────────────────────────────────────────────────────
// Marketing post generation
// ────────────────────────────────────────────────────────────

const PERFIL_DESC: Record<string, string> = {
  D: "Dominante (decisor direto, foca resultado/ROI, decide rápido, sem paciência para enrolação)",
  I: "Influente (relacional, comunicativo, decide pela emoção e relação, valoriza status e prova social)",
  S: "Estável (cauteloso, evita risco, valoriza segurança, garantia e pós-venda, leal quando confia)",
  C: "Cauteloso-Analítico (técnico, quer dados, especificações e comparativos, decide pela lógica)",
};

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
        "Configure uma chave de IA (GEMINI_API_KEY ou GROQ_API_KEY, ambas grátis) para gerar estratégias personalizadas. Enquanto isso, consulte as metodologias e perfis curados na Academia.",
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
// Next Best Action (Fase 5, item 2): próxima ação concreta sugerida pela IA
// a partir do contexto completo do cliente (mesmo contexto rico do Cérebro).
// ────────────────────────────────────────────────────────────

export async function sugerirProximaAcaoIA(
  contexto: string,
  sinais: SinaisProximaAcao
): Promise<{ acao: string; motivo: string }> {
  const fallback = sugerirProximaAcaoHeuristica(sinais);
  if (!iaHabilitada()) return fallback;
  try {
    const raw = await llmTexto(
      `Você é o Cérebro, assistente de vendas de um vendedor de máquinas pesadas (New Holland Construction / Dynapac, sul do Espírito Santo).
Com base no contexto completo do cliente abaixo, sugira a PRÓXIMA AÇÃO CONCRETA que o vendedor deve tomar HOJE
(ex: "Ligar e oferecer test-drive da E215B — ele citou o concorrente Caterpillar e o prazo de safra").
Seja específico: cite a máquina, o concorrente, a visita ou o valor quando existirem no contexto — nunca genérico como "entrar em contato".
Devolva SOMENTE JSON: {"acao": string (máx. 140 caracteres), "motivo": string (1 frase, por que essa ação agora)}.
NUNCA invente dados que não estejam no contexto — se não houver nada específico, sugira uma ação genérica mas honesta.`,
      `Contexto do cliente:\n${contexto}`,
      { maxTokens: 300, json: true }
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const acao = typeof parsed.acao === "string" && parsed.acao.trim() ? parsed.acao.trim().slice(0, 200) : fallback.acao;
    const motivo = typeof parsed.motivo === "string" && parsed.motivo.trim() ? parsed.motivo.trim() : fallback.motivo;
    return { acao, motivo };
  } catch (e) {
    console.error("Falha ao sugerir próxima ação:", e);
    return fallback;
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

// ---------- WhatsApp / Orientador ----------

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
