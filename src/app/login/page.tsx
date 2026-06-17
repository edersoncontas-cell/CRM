import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, authAtivo, senhaCorreta, tokenEsperado } from "@/lib/auth";
import { ExcavatorIcon, RollerIcon } from "@/components/icons";

// Rota de API usada como fonte primária (imune ao middleware de auth).
// O arquivo estático em /public fica como fallback via <source> do <picture>.
const NH_SRC = "/api/foto/nh-escavadeiras.jpg";
const DYN_SRC = "/api/foto/dynapac-rolos.jpg";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  if (!authAtivo()) redirect("/dashboard");

  async function entrar(formData: FormData) {
    "use server";
    const senha = String(formData.get("senha") ?? "");
    if (await senhaCorreta(senha)) {
      cookies().set(COOKIE_NAME, await tokenEsperado(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      redirect("/dashboard");
    }
    redirect("/login?erro=1");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">

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
            <ExcavatorIcon size={64} className="text-agro-400 drop-shadow-lg" />
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-lg ring-4 ring-agro-400/30">
            <ExcavatorIcon size={36} className="text-agro-400" />
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
        {searchParams.erro && (
          <p className="mt-2 text-sm text-red-500">Senha incorreta.</p>
        )}
        <button className="mt-4 w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 transition hover:bg-brand-800">
          Entrar
        </button>
      </form>
    </main>
  );
}
