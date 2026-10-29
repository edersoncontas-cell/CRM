-- Dados de teste do mapa: visitas do dia que a tela de Visitas mostra (pins + trajeto) e vendas faturadas (cifrões).
-- Só para banco de TESTE. Cria os próprios clientes (prefixo tmapa, podem ser apagados) — não depende de nenhum
-- dado que já esteja no banco — e pode rodar de novo (o roteiro roda a cada execução, porque as visitas são do dia de HOJE).
-- Rodar à mão: psql -v ON_ERROR_STOP=1 -f scripts/e2e-mapa/mapa-seed.sql  (sem ON_ERROR_STOP um erro passa batido)

DELETE FROM "Negociacao" WHERE id LIKE 'tmapa%';
DELETE FROM "Visita" WHERE id LIKE 'tmapa%';
DELETE FROM "Cliente" WHERE id LIKE 'tmapa%';

-- Municípios por NOME (é único): cria se faltar; se já existe (o cadastro padrão já traz), mantém a coordenada que ele tem
-- (só preenche se estiver vazia) e o marca "na área" — o roteiro devolve essa marca no fim.
INSERT INTO "Municipio"(id, nome, regiao, lat, lng, "foraDeArea") VALUES
 ('tmapa-m1', 'Cachoeiro de Itapemirim', 'Sul',           -20.8489, -41.1128, false),
 ('tmapa-m2', 'Alegre',                   'Sul',           -20.7578, -41.5336, false),
 ('tmapa-m3', 'Guaçuí',                   'Sul',           -20.7742, -41.6783, false),
 ('tmapa-m4', 'Domingos Martins',         'Serrana',       -20.3603, -40.6594, false),
 ('tmapa-m5', 'Vitória',                  'Metropolitana', -20.3155, -40.3128, false),
 ('tmapa-m6', 'Muqui',                    'Sul',           -20.9500, -41.3467, false)
ON CONFLICT (nome) DO UPDATE SET lat = COALESCE("Municipio".lat, EXCLUDED.lat), lng = COALESCE("Municipio".lng, EXCLUDED.lng), "foraDeArea" = false;

-- Nove clientes, um por venda; três em Cachoeiro, dois em Guaçuí.
INSERT INTO "Cliente"(id, nome, "municipioId", "atualizadoEm")
SELECT c.id, c.nome, m.id, now()
FROM (VALUES
 ('tmapa-c1', 'Cliente teste mapa 1', 'Cachoeiro de Itapemirim'),
 ('tmapa-c2', 'Cliente teste mapa 2', 'Cachoeiro de Itapemirim'),
 ('tmapa-c3', 'Cliente teste mapa 3', 'Cachoeiro de Itapemirim'),
 ('tmapa-c4', 'Cliente teste mapa 4', 'Alegre'),
 ('tmapa-c5', 'Cliente teste mapa 5', 'Guaçuí'),
 ('tmapa-c6', 'Cliente teste mapa 6', 'Guaçuí'),
 ('tmapa-c7', 'Cliente teste mapa 7', 'Domingos Martins'),
 ('tmapa-c8', 'Cliente teste mapa 8', 'Vitória'),
 ('tmapa-c9', 'Cliente teste mapa 9', 'Muqui')
) AS c(id, nome, municipio)
JOIN "Municipio" m ON m.nome = c.municipio;

INSERT INTO "Negociacao"(id, "clienteId", valor, status, "faturadoEm", marca, "maquinaModelo", "atualizadoEm") VALUES
 ('tmapa-n1', 'tmapa-c1', 450000, 'ganha', now(), 'New Holland', 'B95B',  now()),
 ('tmapa-n2', 'tmapa-c2', 620000, 'ganha', now(), 'New Holland', 'E215C', now()),
 ('tmapa-n3', 'tmapa-c3', 380000, 'ganha', now(), 'Dynapac',     'CA25',  now()),
 ('tmapa-n4', 'tmapa-c4', 510000, 'ganha', now(), 'New Holland', 'W130',  now()),
 ('tmapa-n5', 'tmapa-c5', 300000, 'ganha', now(), 'New Holland', 'B95B',  now()),
 ('tmapa-n6', 'tmapa-c6', 280000, 'ganha', now(), 'Dynapac',     'CA15',  now()),
 ('tmapa-n7', 'tmapa-c7', 700000, 'ganha', now(), 'New Holland', 'E245',  now()),
 ('tmapa-n8', 'tmapa-c8', 400000, 'ganha', now(), 'New Holland', 'B95B',  now()),
 ('tmapa-n9', 'tmapa-c9', 250000, 'ganha', now(), 'Dynapac',     'CA25',  now());

-- Seis visitas no dia que a tela de Visitas abre: HOJE em dia útil (Brasília); no sábado e no domingo ela mostra a segunda-feira da
-- semana, então as visitas vão nela. Ficam como REALIZADAS de propósito: visita AGENDADA depois do horário abre o lembrete "Visita
-- feita?" (z-index 150), que cobre o mapa inteiro em dia útil e o e2e mediria um mapa coberto. Realizada ainda vira pin e trajeto.
-- A coluna guarda o horário em UTC: meia-noite de Brasília (03h UTC) + 11 a 17 h = 11h a 17h em Brasília, sempre no mesmo dia.
INSERT INTO "Visita"(id, "clienteId", data, cidade, observacao, status)
SELECT v.id, v."clienteId",
       ((d.dia::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC') + v.hora,
       v.cidade, 'teste', 'realizada'
FROM (
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
         - CASE WHEN extract(isodow FROM now() AT TIME ZONE 'America/Sao_Paulo') >= 6 THEN extract(isodow FROM now() AT TIME ZONE 'America/Sao_Paulo')::int - 1 ELSE 0 END AS dia
) AS d,
(VALUES
 ('tmapa-v1', 'tmapa-c1', interval '11 hours', 'Cachoeiro de Itapemirim'),
 ('tmapa-v2', 'tmapa-c4', interval '12 hours', 'Alegre'),
 ('tmapa-v3', 'tmapa-c5', interval '13 hours', 'Guaçuí'),
 ('tmapa-v4', 'tmapa-c7', interval '15 hours', 'Domingos Martins'),
 ('tmapa-v5', 'tmapa-c8', interval '16 hours', 'Vitória'),
 ('tmapa-v6', 'tmapa-c9', interval '17 hours', 'Muqui')
) AS v(id, "clienteId", hora, cidade);
