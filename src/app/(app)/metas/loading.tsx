export default function CarregandoMetas() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando as metas">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200" />)}
    </div>
  );
}
