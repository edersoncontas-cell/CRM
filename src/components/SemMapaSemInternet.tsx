"use client";

import { Component, type ReactNode } from "react";
import { MapPinOff } from "lucide-react";

// Cerca em volta dos mapas (Dashboard e Visitas). O mapa carrega um arquivo à
// parte (Leaflet, só no navegador) e o desenho vem da internet: na cópia da
// tela aberta sem sinal, esse arquivo não chega — e o erro, sem esta cerca,
// subia até a página e derrubava a tela INTEIRA, tirando dele o resto do
// Dashboard que estava guardado. Com ela, só o lugar do mapa diz o motivo.
export class SemMapaSemInternet extends Component<{ altura: number; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    const semRede = typeof navigator !== "undefined" && navigator.onLine === false;
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500"
        style={{ height: this.props.altura }}
      >
        <MapPinOff size={22} />
        <p className="font-semibold text-slate-600">{semRede ? "O mapa precisa de internet" : "O mapa não carregou"}</p>
        <p className="max-w-xs text-xs">
          {semRede ? "O resto desta tela continua valendo. Com sinal, o mapa volta sozinho ao abrir a tela." : "Recarregue a tela para tentar de novo."}
        </p>
      </div>
    );
  }
}
