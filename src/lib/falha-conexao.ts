// "O banco não respondeu" × "o banco respondeu com erro". Pura (sem banco),
// para ser usada por quem tem mais de um banco à mão: o cliente principal com
// o endereço de reserva (lib/db.ts) e a volta do banco provisório
// (lib/trazer-provisorio.ts), que precisa parar tudo — e dizer — quando um dos
// dois bancos não conecta, em vez de listar o mesmo erro em cada tabela.

export function ehFalhaDeConexao(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const nome = (e as { name?: string }).name ?? "";
  const codigo = (e as { errorCode?: string; code?: string }).errorCode ?? (e as { code?: string }).code ?? "";
  const msg = String((e as { message?: string }).message ?? "");
  return (
    nome === "PrismaClientInitializationError" ||
    codigo === "P1001" || codigo === "P1002" || codigo === "P1017" ||
    /can't reach database server|connection (refused|reset|terminated)|timed out/i.test(msg)
  );
}
