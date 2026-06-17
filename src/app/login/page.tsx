import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, authAtivo, senhaCorreta, tokenEsperado } from "@/lib/auth";
import { ExcavatorIcon, RollerIcon } from "@/components/icons";

// Fotos reais: NH = foto do Ederson; Dynapac = aguardando foto (fundo escuro por ora).
const FOTO_ESCAVADEIRA = "/nh-escavadeiras.jpg";

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
      {/* Fundo dividido com fotos reais */}
      <div className="absolute inset-0 grid grid-cols-1 sm:grid-cols-2">
        {/* New Holland Construction — escavadeira */}
        <div className="relative hidden overflow-hidden sm:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${FOTO_ESCAVADEIRA})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/85 to-brand-900/60" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-10 text-center">
            <ExcavatorIcon size={64} className="text-agro-400 drop-shadow-lg" />
            <div>
              <div className="text-2xl font-black tracking-tight text-white">NEW HOLLAND</div>
              <div className="text-xs font-semibold tracking-[0.4em] text-agro-400">CONSTRUCTION</div>
            </div>
          </div>
        </div>

        {/* Dynapac — rolos compactadores */}
        <div className="relative hidden overflow-hidden sm:block">
          <div
            className="absolute inset-0 bg-cover"
            style={{ backgroundImage: "url(/dynapac-rolos.jpg)", backgroundPosition: "center 60%" }}
          />
          {/* Overlay escuro suave para leitura do texto, deixa os rolos vermelhos aparecerem */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-10 text-center">
            <RollerIcon size={64} className="text-agro-400 drop-shadow-lg" />
            <div>
              <div className="text-2xl font-black tracking-tight text-white drop-shadow-lg">DYNAPAC</div>
              <div className="text-xs font-semibold tracking-[0.4em] text-agro-400">COMPACTION</div>
            </div>
          </div>
        </div>

        {/* Fundo mobile (uma foto só) */}
        <div
          className="absolute inset-0 bg-cover bg-center sm:hidden"
          style={{ backgroundImage: `url(${FOTO_ESCAVADEIRA})` }}
        />
        <div className="absolute inset-0 bg-black/70 sm:hidden" />
      </div>

      {/* Card de login flutuante */}
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
