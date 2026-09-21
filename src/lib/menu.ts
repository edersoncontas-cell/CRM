// Definição central do menu lateral, compartilhada entre o Sidebar e a tela de
// Configurações (visibilidade dos itens). Mantém ícones e rótulos num só lugar.

import {
  LayoutDashboard, Users, Settings, Swords, MessageCircle, Banknote, ClipboardList, Smartphone,
  GraduationCap, FileText, Truck, Brain, Handshake, ListTodo, ShieldCheck, MapPin, Compass, Bell, Calculator, Megaphone, TrendingDown,
  type LucideIcon,
} from "lucide-react";

export type ItemMenu = { href: string; label: string; icon: LucideIcon; fixo?: boolean };
export type GrupoMenu = { label: string; links: ItemMenu[] };

export const GRUPOS: GrupoMenu[] = [
  {
    label: "Principal",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/alertas", label: "Alertas", icon: Bell },
      { href: "/orientador", label: "Orientador de Vendas", icon: Compass },
      { href: "/negociacoes", label: "Negociações", icon: Handshake },
      { href: "/pipeline", label: "Demandas", icon: ListTodo },
      { href: "/atendimento", label: "WhatsApp", icon: MessageCircle },
      { href: "/visitas", label: "Visitas", icon: MapPin },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
  {
    label: "Vendas",
    links: [
      { href: "/maquinas/fichas", label: "Fichas Técnicas", icon: FileText },
      { href: "/comparativo", label: "Comparativo", icon: Swords },
      { href: "/usadas", label: "Máquinas Usadas", icon: Truck },
      { href: "/calculadora", label: "Calculadora de combustível", icon: Calculator },
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
      // Saiu do funil: perdida não é fase de venda, é material de análise.
      { href: "/vendas-perdidas", label: "Vendas Perdidas", icon: TrendingDown },
    ],
  },
  {
    label: "Sistema",
    links: [
      { href: "/cerebro", label: "Central Inteligente", icon: Brain, fixo: true },
      { href: "/zeus", label: "ZEUS", icon: ShieldCheck, fixo: true },
      { href: "/conexao", label: "Conexão WhatsApp", icon: Smartphone },
      { href: "/auditoria", label: "Auditoria", icon: ClipboardList },
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

// ── Ordem personalizada (arrastar e soltar, por aparelho) ───────────────────
const CHAVE_ORDEM = "menu_ordem_v1";

export function lerOrdemMenu(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(CHAVE_ORDEM) ?? "[]");
    return Array.isArray(arr) ? arr.filter((h) => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function salvarOrdemMenu(ordem: string[]) {
  try {
    localStorage.setItem(CHAVE_ORDEM, JSON.stringify(ordem));
    window.dispatchEvent(new CustomEvent(EVENTO_MENU));
  } catch {}
}
