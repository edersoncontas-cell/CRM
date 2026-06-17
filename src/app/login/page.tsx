import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, authAtivo, senhaCorreta, tokenEsperado } from "@/lib/auth";
import { ExcavatorIcon, RollerIcon } from "@/components/icons";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Arte dividida: New Holland (esq, preto/amarelo) | Dynapac (dir, amarelo/preto) */}
      <div className="absolute inset-0 grid grid-cols-2">
        {/* Lado esquerdo — New Holland Construction */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 to-black">
          <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-8 opacity-[0.07]">
            {Array.from({ length: 12 }).map((_, i) => (
              <ExcavatorIcon key={i} size={70} className="text-agro-400" />
            ))}
          </div>
          <ExcavatorIcon size={120} className="relative text-agro-400 drop-shadow-lg" />
          <div className="relative mt-6 text-center">
            <div className="text-2xl font-black tracking-tight text-white">NEW HOLLAND</div>
            <div className="text-sm font-semibold tracking-[0.3em] text-agro-400">CONSTRUCTION</div>
          </div>
        </div>

        {/* Lado direito — Dynapac */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-agro-400 to-agro-600">
          <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-8 opacity-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <RollerIcon key={i} size={70} className="text-black" />
            ))}
          </div>
          <RollerIcon size={120} className="relative text-black drop-shadow" />
          <div className="relative mt-6 text-center">
            <div className="text-2xl font-black tracking-tight text-black">DYNAPAC</div>
            <div className="text-sm font-semibold tracking-[0.3em] text-brand-900">COMPACTION</div>
          </div>
        </div>
      </div>

      {/* Card de login flutuante */}
      <form
        action={entrar}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black shadow-lg">
            <ExcavatorIcon size={30} className="text-agro-400" />
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
