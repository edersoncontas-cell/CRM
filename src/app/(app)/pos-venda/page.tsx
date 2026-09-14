import { redirect } from "next/navigation";

// O pós-venda vive dentro da Central de alertas (grupo "Pós-venda").
export default function PosVendaPage() {
  redirect("/alertas?grupo=posvenda");
}
