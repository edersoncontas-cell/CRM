// Tipos compartilhados do Assistente IA (sem código de servidor — pode ser
// importado tanto pelas server actions quanto pelo componente cliente).

export type TipoAcao =
  | "criar_cliente"
  | "editar_cliente"
  | "criar_card"
  | "criar_tarefa"
  | "agendar_visita";

// Uma ação já interpretada e resolvida, pronta para o usuário confirmar.
export type AcaoPlano = {
  tipo: TipoAcao;
  descricao: string;                 // texto humano para o usuário confirmar
  dados: Record<string, unknown>;    // dados resolvidos para executar
  erro?: string;                     // preenchido quando não foi possível resolver
};
