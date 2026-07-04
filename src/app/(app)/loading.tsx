// Skeleton genérico exibido pelo Next enquanto uma página (app)/* carrega.
// Sem isso, a troca de página ficava com tela branca (60 páginas são
// force-dynamic e não tinham nenhum loading.tsx no app inteiro).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-slate-200" />
          <div className="h-3 w-72 rounded-lg bg-slate-100" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
