"use client";

import { useCallback, useEffect, useState } from "react";
import { lerPacote, lerFila, aoMudar } from "@/lib/sem-sinal-local";
import { sincronizar, estadoSincronia, type ResumoSincronia } from "@/lib/sem-sinal-sincronia";
import type { PacoteSemSinal, RegistroFila } from "@/lib/sem-sinal-regra";

/** O que está guardado no aparelho, sempre atualizado (esta aba e as outras). */
export function useSemSinal() {
  const [carregado, setCarregado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [pacote, setPacote] = useState<PacoteSemSinal | null>(null);
  const [fila, setFila] = useState<RegistroFila[]>([]);
  const [sinc, setSinc] = useState<{ rodando: boolean; ultimo: ResumoSincronia | null }>({ rodando: false, ultimo: null });

  const recarregar = useCallback(async () => {
    setSinc(estadoSincronia());
    try {
      const [p, f] = await Promise.all([lerPacote(), lerFila()]);
      setPacote(p);
      setFila(f);
      setFalha(null);
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    recarregar();
    return aoMudar(recarregar);
  }, [recarregar]);

  return { carregado, falha, pacote, fila, sinc, recarregar };
}

/** Com internet ou sem? Começa pelo que o navegador diz e segue os avisos dele. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine !== false);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);
  return online;
}

/**
 * Sobe e baixa sozinho:
 *  - ao abrir (pacote só se tiver mais de 30 min — cada pacote são consultas
 *    no banco, e o banco grátis tem cota);
 *  - quando a internet volta (aí baixa sempre: pode ter mudado muita coisa);
 *  - quando a tela volta a ficar visível;
 *  - a cada minuto, só se houver algo esperando para subir.
 */
export function useSincroniaAutomatica() {
  useEffect(() => {
    let vivo = true;
    const rodar = (baixar: "sempre" | "se_velho" | "nunca") => {
      if (!vivo || document.visibilityState === "hidden") return;
      sincronizar({ baixar }).catch(() => {});
    };
    rodar("se_velho");
    const aoVoltarInternet = () => rodar("sempre");
    const aoAparecer = () => { if (document.visibilityState === "visible") rodar("se_velho"); };
    window.addEventListener("online", aoVoltarInternet);
    document.addEventListener("visibilitychange", aoAparecer);
    const t = window.setInterval(() => {
      if (navigator.onLine === false) return;
      lerFila()
        .then((f) => { if (f.some((r) => r.estado === "pendente")) rodar("nunca"); })
        .catch(() => {});
    }, 60_000);
    return () => {
      vivo = false;
      window.removeEventListener("online", aoVoltarInternet);
      document.removeEventListener("visibilitychange", aoAparecer);
      window.clearInterval(t);
    };
  }, []);
}
