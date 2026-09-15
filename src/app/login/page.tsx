import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, authAtivo, senhaCorreta, tokenEsperado, cookieOpts } from "@/lib/auth";
import { ipDaRequisicao, minutosBloqueado, registrarFalhaLogin, limparFalhasLogin } from "@/lib/login-guard";
import { EscavadeiraAmarela, LogoEscavadeira, RollerIcon } from "@/components/icons";
import { EntradaAutomatica } from "@/components/EntradaAutomatica";

// Rota de API usada como fonte primária (imune ao middleware de auth).
// O arquivo estático em /public fica como fallback via <source> do <picture>.
const NH_SRC = "/api/foto/nh-escavadeiras.jpg";
const DYN_SRC = "/api/foto/dynapac-rolos.jpg";

// Sempre renderizado por requisição: a decisão de redirecionar depende de
// APP_PASSWORD em tempo de execução. Se a página fosse pré-renderizada num
// build sem a variável, o redirect ficaria congelado no cache estático.
export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; min?: string };
}) {
  if (!authAtivo()) redirect("/dashboard");

  async function entrar(formData: FormData) {
    "use server";
    // Força bruta: 5 senhas erradas em 15 min bloqueiam o IP por 15 min.
    const ip = ipDaRequisicao();
    const bloqueado = await minutosBloqueado(ip);
    if (bloqueado > 0) redirect(`/login?erro=bloqueado&min=${bloqueado}`);
    const senha = String(formData.get("senha") ?? "");
    if (await senhaCorreta(senha)) {
      await limparFalhasLogin(ip);
      cookies().set(COOKIE_NAME, await tokenEsperado(), cookieOpts());
      redirect("/dashboard");
    }
    const { bloqueadoMin } = await registrarFalhaLogin(ip);
    // Atraso pequeno torna a tentativa em massa lenta sem atrapalhar quem errou uma vez.
    await new Promise((r) => setTimeout(r, 800));
    redirect(bloqueadoMin > 0 ? `/login?erro=bloqueado&min=${bloqueadoMin}` : "/login?erro=1");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">

      {/* Cobre a tela de preto IMEDIATAMENTE se houver sessão salva, evitando o
          flash do formulário antes do splash do React aparecer. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(localStorage.getItem('crm_token')){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;z-index:95;background:#000';document.body.appendChild(d);}}catch(e){}",
        }}
      />

      {/* Auto-login + splash futurista (reforço para o PWA do iPhone) */}
      <EntradaAutomatica />

      {/* ── Painéis laterais (sm+) ── */}
      <div className="absolute inset-0 hidden sm:flex">

        {/* Esquerdo — New Holland Construction */}
        <div className="relative flex-1 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={NH_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center 55%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-10 text-center">
            <EscavadeiraAmarela size={96} className="drop-shadow-lg" />
            <div>
              <div className="text-2xl font-black tracking-tight text-white">NEW HOLLAND</div>
              <div className="text-xs font-semibold tracking-[0.4em] text-agro-400">CONSTRUCTION</div>
            </div>
          </div>
        </div>

        {/* Direito — Dynapac Compaction */}
        <div className="relative flex-1 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DYN_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center 65%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-10 text-center">
            <RollerIcon size={64} className="text-agro-400 drop-shadow-lg" />
            <div>
              <div className="text-2xl font-black tracking-tight text-white">DYNAPAC</div>
              <div className="text-xs font-semibold tracking-[0.4em] text-agro-400">COMPACTION</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fundo mobile ── */}
      <div className="absolute inset-0 sm:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NH_SRC}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          style={{ objectPosition: "center 55%" }}
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* ── Card de login ── */}
      <form
        action={entrar}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-4 ring-agro-400/30">
            <LogoEscavadeira size={80} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">CRM DO EDY</h1>
          <p className="text-sm text-slate-500">Vendas inteligentes com IA · New Holland · Dynapac</p>
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
        <input
          name="senha"
          type="password"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-200"
        />
        {searchParams.erro === "bloqueado" ? (
          <p className="mt-2 text-sm text-red-500">Muitas tentativas. Aguarde {searchParams.min ?? "15"} min e tente de novo.</p>
        ) : searchParams.erro ? (
          <p className="mt-2 text-sm text-red-500">Senha incorreta.</p>
        ) : null}
        <button className="mt-4 w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 transition hover:bg-brand-800">
          Entrar
        </button>
      </form>
    </main>
  );
}
