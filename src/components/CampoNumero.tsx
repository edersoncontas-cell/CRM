"use client";

// Campo numérico que não "briga" com quem está digitando.
//
// Antes, o <input type="number"> ficava controlado direto pelo número: a
// cada tecla, o valor virava Number(texto) e voltava para o campo já
// normalizado. Em vários navegadores isso reposiciona o cursor no INÍCIO do
// campo depois de cada atualização — então digitar "10" em cima do "0" dava
// "0" → "10" (cursor volta pro início) → próxima tecla entra ANTES, dando
// "010". Aqui o que aparece no campo é o texto que a pessoa está digitando
// (só filtra o que não é dígito/separador); o número só é calculado a
// partir dele. Sem reformatar a cada tecla, o cursor não pula.
//
// Sem select-all no foco de propósito: clicar para EDITAR ou ACRESCENTAR um
// número (corrigir um dígito no meio, completar no fim) precisa continuar
// funcionando normal — só o "0" some, porque 0 é exibido como campo vazio.
// E apagar com backspace até o fim (direita pra esquerda) some por completo,
// sem nenhum dígito ficar preso — regra pura em lib/campo-numero-regra.ts.

import { useEffect, useRef, useState } from "react";
import { paraTexto, paraNumero, sanitizarDigitado } from "@/lib/campo-numero-regra";

export function CampoNumero({
  id,
  value,
  onChange,
  placeholder = "0",
  inteiro = false,
  className,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  /** Campo de número inteiro (parcelas, dias, meses…) — não aceita vírgula. */
  inteiro?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState(() => paraTexto(value));
  // Se o número mudou por fora (botão "Limpar", carregado do localStorage,
  // outro campo recalculando) e não é o que esta pessoa estava digitando,
  // sincroniza o texto — sem isso o campo ficaria com um valor velho.
  const ultimoEnviado = useRef(value);
  useEffect(() => {
    if (value !== ultimoEnviado.current) {
      setTexto(paraTexto(value));
      ultimoEnviado.current = value;
    }
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={texto}
      placeholder={placeholder}
      onChange={(e) => {
        const t = sanitizarDigitado(e.target.value, inteiro);
        setTexto(t);
        const n = paraNumero(t);
        ultimoEnviado.current = n;
        onChange(n);
      }}
      onBlur={() => setTexto(paraTexto(paraNumero(texto)))}
      className={className}
    />
  );
}
