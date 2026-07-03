// Página de aviso exibida quando a aplicação está em produção sem
// APP_PASSWORD configurado. Nunca depende de banco de dados — o middleware
// bloqueia tudo antes de chegar aqui, então esta tela precisa funcionar
// mesmo com a configuração quebrada.
export default function ConfigNecessariaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-white/95 p-8 text-center shadow-2xl">
        <h1 className="text-xl font-black tracking-tight text-red-600">
          Configuração necessária
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          O CRM está em produção sem a variável <code className="rounded bg-slate-100 px-1">APP_PASSWORD</code> configurada,
          então o acesso foi bloqueado por segurança.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Configure <code className="rounded bg-slate-100 px-1">APP_PASSWORD</code> (e{" "}
          <code className="rounded bg-slate-100 px-1">AUTH_SECRET</code>) nas variáveis de ambiente da Vercel e faça um novo deploy.
        </p>
      </div>
    </main>
  );
}
