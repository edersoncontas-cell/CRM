// Sonda do robô do café (GitHub Actions, workflow "Sonda café"): mostra o que
// a API do Painel do Café devolve. Só imprime; não grava nada.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const res = await fetch("https://api.coffee-panel.mitrix.online/api/home/information", { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
console.log("status", res.status, res.headers.get("content-type"));
const j = await res.json();
console.log("chaves:", Object.keys(j));
for (const k of Object.keys(j)) {
  if (k === "messages" || k === "news") { console.log(`\n## ${k}: ${Array.isArray(j[k]) ? j[k].length + " itens" : typeof j[k]}`); continue; }
  console.log(`\n## ${k}:\n` + JSON.stringify(j[k], null, 1).slice(0, 4000));
}
