import { Card } from "@/components/ui";
import { Download, Database } from "lucide-react";

const ARQUIVOS = [
  { tipo: "clientes", rotulo: "Clientes", desc: "cadastro, município, status, frota, resumo" },
  { tipo: "negociacoes", rotulo: "Negociações", desc: "funil, valores, faturamento, comissões" },
  { tipo: "visitas", rotulo: "Visitas", desc: "agenda completa" },
  { tipo: "mensagens", rotulo: "Mensagens do WhatsApp", desc: "até 50 mil mensagens mais recentes" },
  { tipo: "pos-venda", rotulo: "Pós-venda", desc: "contatos e marcos registrados" },
];

// Exportação em CSV (abre direto no Excel em português). Os links passam
// pelo login como qualquer página; o navegador baixa o arquivo.
export function ExportarDadosCard() {
  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <Database size={18} className="text-brand-600" /> Exportar dados
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Os dados são seus. Baixe em CSV (abre no Excel) para backup, contabilidade ou migração. Guarde uma cópia por mês.
      </p>
      <div className="flex flex-wrap gap-2">
        {ARQUIVOS.map((a) => (
          <a key={a.tipo} href={`/api/exportar/${a.tipo}`} title={a.desc}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50">
            <Download size={14} /> {a.rotulo}
          </a>
        ))}
      </div>
    </Card>
  );
}
