import { redirect } from "next/navigation";

// "Modelos em Foco" saiu do menu — links antigos para /maquinas caem nas
// Fichas Técnicas (a lista de máquinas continua lá).
export default function MaquinasRedirect() {
  redirect("/maquinas/fichas");
}
