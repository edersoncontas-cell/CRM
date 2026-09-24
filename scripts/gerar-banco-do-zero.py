# Regera src/lib/banco-do-zero-ddl.ts a partir do schema.prisma.
#   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/ddl.sql
#   python3 scripts/gerar-banco-do-zero.py /tmp/ddl.sql
import json, re, sys
sql = open(sys.argv[1], encoding="utf-8").read()
sem_coment = "\n".join(l for l in sql.splitlines() if not l.strip().startswith("--"))
partes = [p.rstrip(";").strip() for p in re.split(r";\s*\n", sem_coment) if p.strip()]
tabelas = sum(1 for p in partes if p.startswith("CREATE TABLE"))
idx = sum(1 for p in partes if "INDEX" in p.split("\n")[0])
fks = sum(1 for p in partes if p.startswith("ALTER TABLE") and "FOREIGN KEY" in p)
out = ["// GERADO — não editar à mão. Regerar com:",
       "//   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
       "//   e passar o resultado por scripts/gerar-banco-do-zero.py", "//",
       "// A estrutura INTEIRA do banco, na ordem certa (tabelas, índices, chaves",
       "// estrangeiras), para o CRM nascer num banco vazio. Ver lib/banco-do-zero.ts.",
       f"// {tabelas} tabelas · {idx} índices · {fks} chaves estrangeiras.", "",
       "export const DDL_DO_ZERO: readonly string[] = ["]
out += ["  " + json.dumps(p, ensure_ascii=False) + "," for p in partes] + ["];"]
open("src/lib/banco-do-zero-ddl.ts", "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"comandos={len(partes)} tabelas={tabelas} indices={idx} fks={fks}")
