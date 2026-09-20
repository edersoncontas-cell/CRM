"use client";

// Seletor de data no padrão iOS (rodas giratórias por coluna, com "snap" no
// centro) — substitui os <input type="date"/"month"> nativos, que no desktop
// abrem um calendário genérico e não têm o mesmo padrão visual em todo lugar.

import { useEffect, useRef, useState } from "react";

const ITEM_H = 40;
const VISIBLE = 5; // ímpar para ter um centro exato
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

type Opcao = { value: number; label: string };

function WheelColumn({ options, value, onChange, width }: {
  options: Opcao[]; value: number; onChange: (v: number) => void; width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  // Posiciona no valor certo quando ele muda de fora (troca de mês/ano
  // reduzindo os dias disponíveis, ou abertura inicial) sem depender do
  // usuário ter rolado — sem animação, para não brigar com o scroll-snap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desejado = idx * ITEM_H;
    if (Math.abs(el.scrollTop - desejado) > 2) el.scrollTop = desejado;
  }, [idx]);

  function onScroll() {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      const opt = options[i];
      if (opt && opt.value !== value) onChange(opt.value);
    }, 120);
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="no-scrollbar snap-y snap-mandatory overflow-y-scroll"
      style={{ height: ITEM_H * VISIBLE, width }}
    >
      <div style={{ height: PAD }} />
      {options.map((o) => (
        <div
          key={o.value}
          onClick={() => { onChange(o.value); ref.current?.scrollTo({ top: options.findIndex((x) => x.value === o.value) * ITEM_H, behavior: "smooth" }); }}
          className="flex snap-center items-center justify-center text-base transition-colors"
          style={{ height: ITEM_H, color: o.value === value ? "#0f172a" : "#9ca3af", fontWeight: o.value === value ? 700 : 400 }}
        >
          {o.label}
        </div>
      ))}
      <div style={{ height: PAD }} />
    </div>
  );
}

function CentroDestaque() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg border-y"
      style={{ height: ITEM_H, background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.35)" }}
    />
  );
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function diasNoMes(mes: number, ano: number): number {
  return new Date(ano, mes, 0).getDate();
}

// A folha que envolve os quatro seletores (data, data+hora, horário, mês).
//
//   "quando vou registrar uma nova visita e clico para selecionar uma data
//    futura, o pop up de selecionar a data e hora ficam por trás da janela
//    atual que aparece"
//
// O z-index alto NÃO é exagero: o seletor quase sempre é aberto de DENTRO de
// um modal ("Nova visita", "Novo compromisso", nova negociação), e esses
// modais estão em z-[100]. Em z-50 a folha abria atrás da janela que a
// chamou — a data ficava impossível de escolher. Ele tem de ficar acima de
// qualquer janela que possa abri-lo, por isso é o maior número interativo do
// CRM. Quem for mexer: não baixe sem conferir o z-index dos modais.
function Folha({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="mb-2 text-center text-sm font-semibold text-slate-700">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Seletor de data completa (dia/mês/ano) — "Faturado em" ──
export function WheelDatePicker({ valueISO, onConfirm, onClose, title }: {
  valueISO: string; onConfirm: (iso: string) => void; onClose: () => void; title?: string;
}) {
  const base = valueISO ? new Date(valueISO + "T12:00:00") : new Date();
  const [dia, setDia] = useState(base.getDate());
  const [mes, setMes] = useState(base.getMonth() + 1);
  const [ano, setAno] = useState(base.getFullYear());

  const maxDia = diasNoMes(mes, ano);
  useEffect(() => { if (dia > maxDia) setDia(maxDia); }, [mes, ano, dia, maxDia]);

  const diaOpts: Opcao[] = Array.from({ length: maxDia }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const mesOpts: Opcao[] = MESES.map((m, i) => ({ value: i + 1, label: m.slice(0, 3) }));
  const anoAtual = new Date().getFullYear();
  const anoOpts: Opcao[] = Array.from({ length: 15 }, (_, i) => anoAtual - 10 + i).map((a) => ({ value: a, label: String(a) }));

  function confirmar() {
    const d = String(Math.min(dia, maxDia)).padStart(2, "0");
    const m = String(mes).padStart(2, "0");
    onConfirm(`${ano}-${m}-${d}`);
  }

  return (
    <Folha title={title ?? "Selecione a data"} onClose={onClose}>
      <div className="relative flex justify-center">
        <CentroDestaque />
        <WheelColumn options={diaOpts} value={Math.min(dia, maxDia)} onChange={setDia} width={56} />
        <WheelColumn options={mesOpts} value={mes} onChange={setMes} width={88} />
        <WheelColumn options={anoOpts} value={ano} onChange={setAno} width={72} />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button onClick={confirmar} className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">Confirmar</button>
      </div>
    </Folha>
  );
}

// ── Seletor de data + hora (dia/mês/ano/hora/minuto) — ex: "Data da Visita" ──
export function WheelDateTimePicker({ valueLocal, onConfirm, onClose, title }: {
  // valueLocal no formato "YYYY-MM-DDTHH:mm" (mesmo shape de <input type="datetime-local">)
  valueLocal: string; onConfirm: (local: string) => void; onClose: () => void; title?: string;
}) {
  const base = valueLocal ? new Date(valueLocal) : new Date();
  const [dia, setDia] = useState(base.getDate());
  const [mes, setMes] = useState(base.getMonth() + 1);
  const [ano, setAno] = useState(base.getFullYear());
  const [hora, setHora] = useState(base.getHours());
  const [minuto, setMinuto] = useState(Math.round(base.getMinutes() / 5) * 5 % 60);

  const maxDia = diasNoMes(mes, ano);
  useEffect(() => { if (dia > maxDia) setDia(maxDia); }, [mes, ano, dia, maxDia]);

  const diaOpts: Opcao[] = Array.from({ length: maxDia }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const mesOpts: Opcao[] = MESES.map((m, i) => ({ value: i + 1, label: m.slice(0, 3) }));
  const anoAtual = new Date().getFullYear();
  const anoOpts: Opcao[] = Array.from({ length: 15 }, (_, i) => anoAtual - 5 + i).map((a) => ({ value: a, label: String(a) }));
  const horaOpts: Opcao[] = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));
  const minutoOpts: Opcao[] = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: String(i * 5).padStart(2, "0") }));

  function confirmar() {
    const d = String(Math.min(dia, maxDia)).padStart(2, "0");
    const m = String(mes).padStart(2, "0");
    const h = String(hora).padStart(2, "0");
    const min = String(minuto).padStart(2, "0");
    onConfirm(`${ano}-${m}-${d}T${h}:${min}`);
  }

  return (
    <Folha title={title ?? "Selecione data e hora"} onClose={onClose}>
      <div className="relative flex justify-center">
        <CentroDestaque />
        <WheelColumn options={diaOpts} value={Math.min(dia, maxDia)} onChange={setDia} width={44} />
        <WheelColumn options={mesOpts} value={mes} onChange={setMes} width={68} />
        <WheelColumn options={anoOpts} value={ano} onChange={setAno} width={60} />
        <WheelColumn options={horaOpts} value={hora} onChange={setHora} width={44} />
        <WheelColumn options={minutoOpts} value={minuto} onChange={setMinuto} width={44} />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button onClick={confirmar} className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">Confirmar</button>
      </div>
    </Folha>
  );
}

// ── Seletor de horário (hora/minuto) — ex: horário de uma visita ──
export function WheelTimePicker({ valueHM, onConfirm, onClose, title }: {
  // valueHM no formato "HH:mm"
  valueHM: string; onConfirm: (hm: string) => void; onClose: () => void; title?: string;
}) {
  const [h, m] = valueHM ? valueHM.split(":").map(Number) : [new Date().getHours(), 0];
  const [hora, setHora] = useState(h);
  const [minuto, setMinuto] = useState(Math.round((m ?? 0) / 5) * 5 % 60);

  const horaOpts: Opcao[] = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));
  const minutoOpts: Opcao[] = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: String(i * 5).padStart(2, "0") }));

  function confirmar() {
    onConfirm(`${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`);
  }

  return (
    <Folha title={title ?? "Horário"} onClose={onClose}>
      <div className="relative flex justify-center">
        <CentroDestaque />
        <WheelColumn options={horaOpts} value={hora} onChange={setHora} width={64} />
        <WheelColumn options={minutoOpts} value={minuto} onChange={setMinuto} width={64} />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button onClick={confirmar} className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">Confirmar</button>
      </div>
    </Folha>
  );
}

// ── Seletor de mês/ano — "Mês pago" ──
export function WheelMonthPicker({ valueMes, onConfirm, onClose, title }: {
  valueMes: string; onConfirm: (mesAno: string) => void; onClose: () => void; title?: string;
}) {
  const [anoBase, mesBase] = valueMes ? valueMes.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [mes, setMes] = useState(mesBase);
  const [ano, setAno] = useState(anoBase);

  const mesOpts: Opcao[] = MESES.map((m, i) => ({ value: i + 1, label: m }));
  const anoAtual = new Date().getFullYear();
  const anoOpts: Opcao[] = Array.from({ length: 15 }, (_, i) => anoAtual - 10 + i).map((a) => ({ value: a, label: String(a) }));

  function confirmar() {
    onConfirm(`${ano}-${String(mes).padStart(2, "0")}`);
  }

  return (
    <Folha title={title ?? "Mês pago"} onClose={onClose}>
      <div className="relative flex justify-center">
        <CentroDestaque />
        <WheelColumn options={mesOpts} value={mes} onChange={setMes} width={120} />
        <WheelColumn options={anoOpts} value={ano} onChange={setAno} width={72} />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button onClick={confirmar} className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">Confirmar</button>
      </div>
    </Folha>
  );
}
