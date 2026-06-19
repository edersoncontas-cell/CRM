// Definição central do menu lateral, compartilhada entre o Sidebar e a tela de
// Configurações (visibilidade dos itens). Mantém ícones e rótulos num só lugar.

import {
  LayoutDashboard, Users, KanbanSquare, MessagesSquare, Calendar,
  TrendingDown, Sparkles, Megaphone, Settings, Calculator,
  Swords, Route, Send, Map, CalendarRange, BrainCircuit, MessageCircle,
  Banknote, ClipboardList, Smartphone, GraduationCap, Star, FileText, Trophy,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type ItemMenu = { href: string; label: string; icon: LucideIcon; fixo?: boolean };
export type GrupoMenu = { label: string; links: ItemMenu[] };

export const GRUPOS: GrupoMenu[] = [
  {
    label: "Principal",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "WhatsApp", icon: MessageCircle },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/mapa", label: "Mapa", icon: Map },
      { href: "/radar", label: "Radar de safra", icon: CalendarRange },
    ],
  },
  {
    label: "Vendas",
    links: [
      { href: "/pipeline", label: "Pipeline Kanban", icon: KanbanSquare },
      { href: "/maquinas", label: "Modelos em Foco", icon: Star },
      { href: "/usadas", label: "Máquinas Usadas", icon: Truck },
      { href: "/maquinas/fichas", label: "Fichas Técnicas", icon: FileText },
      { href: "/super-trunfo", label: "Super Trunfo", icon: Trophy },
      { href: "/comparativo", label: "Comparativo", icon: Swords },
      { href: "/conversas", label: "Conversas + IA", icon: MessagesSquare },
      { href: "/resumos", label: "Resumos IA", icon: ClipboardList },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/roteiro", label: "Roteiro", icon: Route },
      { href: "/simulador", label: "Simulador", icon: Calculator },
    ],
  },
  {
    label: "Marketing",
    links: [
      { href: "/marketing", label: "Marketing IA", icon: BrainCircuit },
      { href: "/campanhas", label: "Campanhas", icon: Send },
      { href: "/midia", label: "Mídia", icon: Megaphone },
    ],
  },
  {
    label: "Treinamento",
    links: [
      { href: "/academia", label: "Academia de Vendas", icon: GraduationCap },
    ],
  },
  {
    label: "Análise",
    links: [
      { href: "/financeiro", label: "Financeiro", icon: Banknote },
      { href: "/historico", label: "Histórico de Negócios", icon: ClipboardList },
      { href: "/vendas-perdidas", label: "Vendas Perdidas", icon: TrendingDown },
      { href: "/sugestoes", label: "Sugestões IA", icon: Sparkles },
    ],
  },
  {
    label: "Sistema",
    links: [
      { href: "/conexao", label: "Conexão WhatsApp", icon: Smartphone },
      { href: "/auditoria", label: "Auditoria", icon: ClipboardList },
      // Configurações é fixo: nunca pode ser ocultado (senão não há como reativar).
      { href: "/configuracoes", label: "Configurações", icon: Settings, fixo: true },
    ],
  },
];

export const TODOS_HREFS = GRUPOS.flatMap((g) => g.links.map((l) => l.href));

// ── Visibilidade (preferência por aparelho, no localStorage) ────────────────
const CHAVE_OCULTOS = "menu_ocultos_v1";
export const EVENTO_MENU = "menu-visibilidade";

export function lerMenuOcultos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(CHAVE_OCULTOS) ?? "[]");
    return Array.isArray(arr) ? arr.filter((h) => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function salvarMenuOcultos(ocultos: string[]) {
  try {
    localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(ocultos));
    window.dispatchEvent(new CustomEvent(EVENTO_MENU));
  } catch {}
}
