// Teste ao vivo do robô do café (GitHub Actions): chama a API do Painel do
// Café e o CCCV e passa pelos MESMOS leitores usados no CRM.
import { lerJsonPainelDoCafe, lerTabelaCCCV, htmlParaTexto } from "../src/lib/cafe-parsers";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function main() {
  const r = await fetch("https://api.coffee-panel.mitrix.online/api/home/information", { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  console.log("Painel do Café → HTTP", r.status);
  const painel = lerJsonPainelDoCafe(await r.json());
  console.log("Painel do Café lido:", JSON.stringify(painel));
  const c = await fetch("https://www.cccv.org.br/cotacao/", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  console.log("CCCV → HTTP", c.status);
  console.log("CCCV lido:", JSON.stringify(lerTabelaCCCV(htmlParaTexto(await c.text()))));
  if (!painel?.conilon || !painel?.arabica) { console.error("FALHOU: Painel do Café sem conilon/arábica"); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
