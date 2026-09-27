// Os marcos de acompanhamento pós-venda (puro — lido pelas ações do servidor
// e pela Central de Alertas). Fora de lib/actions.ts porque arquivo "use
// server" só pode exportar função async.

export const MARCOS_POS_VENDA = [
  { tipo: "marco_365d", dias: 365, label: "1 ano" },
  { tipo: "marco_180d", dias: 180, label: "6 meses" },
  { tipo: "marco_60d", dias: 60, label: "60 dias" },
  { tipo: "marco_30d", dias: 30, label: "30 dias" },
] as const;

export function calcularMarcoPendente(diasDesdeFaturamento: number, tiposFeitos: Set<string>): { tipo: string; label: string } | null {
  const marco = MARCOS_POS_VENDA.find((m) => diasDesdeFaturamento >= m.dias && !tiposFeitos.has(m.tipo));
  return marco ? { tipo: marco.tipo, label: marco.label } : null;
}

/**
 * O pós-venda que ele marcou como "Resolvido" volta quando vence um marco
 * DEPOIS do clique: resolveu no dia 35 (marco de 30 dias), o cliente volta no
 * dia 60. Por data — a chave guardada continua estável (lib/alerta-chave.ts),
 * que é o que impede o card de voltar sozinho sem motivo.
 */
export function posVendaVoltou(
  p: { dataCompra: string | null; marcoPendente: { tipo: string } | null },
  resolvidoEm: Date | null,
): boolean {
  if (!resolvidoEm || !p.dataCompra || !p.marcoPendente) return false;
  const marco = MARCOS_POS_VENDA.find((m) => m.tipo === p.marcoPendente!.tipo);
  if (!marco) return false;
  const venceEm = new Date(p.dataCompra).getTime() + marco.dias * 86_400_000;
  return venceEm > resolvidoEm.getTime();
}
