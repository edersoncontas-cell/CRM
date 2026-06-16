import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, authAtivo, senhaCorreta, tokenEsperado } from "@/lib/auth";
import { Tractor } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-950 p-4">
      <form
        action={entrar}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-xl bg-brand-600 p-3 text-white">
            <Tractor size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">CRM New Holland</h1>
          <p className="text-sm text-slate-500">Vendas inteligentes com IA</p>
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
        <input
          name="senha"
          type="password"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {searchParams.erro && (
          <p className="mt-2 text-sm text-red-500">Senha incorreta.</p>
        )}
        <button className="mt-4 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white transition hover:bg-brand-700">
          Entrar
        </button>
      </form>
    </main>
  );
}
