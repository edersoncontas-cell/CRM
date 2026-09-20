// Tipos da criação de arte, num arquivo só deles para o módulo do Gemini e o
// da OpenAI não importarem um ao outro (o que criaria ciclo, já que o
// orquestrador em imagem.ts importa os dois).

export type ImagemGerada = { base64: string; mimeType: string; modelo: string };
export type Referencia = { base64: string; mimeType: string };
