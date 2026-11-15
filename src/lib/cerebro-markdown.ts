// Texto do chat do Cérebro → HTML. Módulo PURO (sem banco), para o teste e a tela.
//
// A resposta do agente é escapada ANTES de virar HTML. O único link que ganha
// vida é [texto](/api/relatorios?...) com caracteres seguros — o relatório que o
// próprio agente gerou. Link para qualquer outro lugar (http://…, javascript:…)
// continua texto puro, para a resposta de uma IA nunca mandar o vendedor para fora.

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Depois do escape o "&" é "&amp;". Só letras, números e _ = & ; % . -.
const RE_LINK_RELATORIO = /\[([^\]\n]{1,120})\]\((\/api\/relatorios\?(?:[A-Za-z0-9_=.%-]|&amp;)+)\)/g;

export function renderMarkdown(text: string): string {
  if (!text) return "";
  return escapeHtml(text)
    .replace(RE_LINK_RELATORIO, (_m, rotulo: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noopener" class="text-agro-400 underline font-medium">${rotulo}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3 class='text-sm font-bold text-white mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-sm font-bold text-white mt-3 mb-1'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-base font-bold text-white mt-3 mb-1'>$1</h1>")
    .replace(/^---$/gm, "<hr class='border-zinc-700 my-2'/>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^• (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    .replace(/`([^`]+)`/g, "<code class='bg-zinc-800 px-1 rounded text-xs font-mono text-yellow-300'>$1</code>")
    .replace(/\n/g, "<br/>");
}
