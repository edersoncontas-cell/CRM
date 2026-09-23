"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_TEMA, MAX_IDADE_TEMA, modoValido, type ModoTema } from "@/lib/tema";

// Gravar a escolha de tema. Vai em cookie porque o servidor precisa saber o
// tema na hora de montar o HTML (ver o comentário em lib/tema.ts).
export async function definirTemaAction(modo: ModoTema): Promise<void> {
  cookies().set(COOKIE_TEMA, modoValido(modo), {
    maxAge: MAX_IDADE_TEMA,
    path: "/",
    sameSite: "lax",
    // Não é httpOnly de propósito: não tem nada de sigiloso e assim a tela
    // pode confirmar o que está valendo sem uma volta ao servidor.
    httpOnly: false,
  });
  // A casca inteira muda de cor: revalida a raiz, não só a tela atual.
  revalidatePath("/", "layout");
}
