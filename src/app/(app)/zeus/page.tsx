import { redirect } from "next/navigation";

// O ZEUS mora dentro da Central Inteligente desde 05/11 (aba "ZEUS").
// Este endereço continua existindo para quem tem o link guardado e para a
// tela de erro geral, que manda olhar o ZEUS.
export default function ZeusPage() {
  redirect("/cerebro?aba=zeus");
}
