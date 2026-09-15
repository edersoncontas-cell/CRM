// Sonda do robô do café (GitHub Actions, workflow "Sonda café"): mostra o que
// as fontes devolvem. Só imprime; não grava nada.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function baixar(url, extra = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", "Accept-Language": "pt-BR,pt;q=0.9", Origin: "https://www.paineldocafe.com.br", Referer: "https://www.paineldocafe.com.br/", ...extra }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const corpo = await res.text();
    console.log(`\n=== GET ${url} → ${res.status} ${res.headers.get("content-type")} · ${corpo.length} bytes · ${Date.now() - t0} ms`);
    return { ok: res.ok, corpo };
  } catch (e) {
    console.log(`\n=== GET ${url} → ERRO ${e instanceof Error ? e.message : e}`);
    return { ok: false, corpo: "" };
  }
}

const API = "https://api.coffee-panel.mitrix.online/api/home";
for (const p of ["/information", "/news/information", "/messages/information", "/banners/information", "/campaigns/information", "/files/information"]) {
  const r = await baixar(API + p);
  console.log(r.corpo.slice(0, 5000));
}
// Sem cabeçalhos de origem (como a Vercel chamaria por padrão)
{
  const res = await fetch(API + "/information", { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) }).catch((e) => ({ status: "ERRO " + e.message, text: async () => "" }));
  console.log("\n=== sem Origin/Referer →", res.status, (await res.text()).slice(0, 600));
}
