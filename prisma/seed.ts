import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MUNICIPIOS = [
  "Cachoeiro de Itapemirim", "Itapemirim", "Marataízes", "Presidente Kennedy",
  "Piúma", "Anchieta", "Iconha", "Rio Novo do Sul", "Vargem Alta", "Castelo",
  "Alegre", "Guaçuí", "Mimoso do Sul", "Muqui", "Atílio Vivácqua", "Apiacá",
  "Bom Jesus do Norte", "São José do Calçado", "Jerônimo Monteiro",
  "Muniz Freire", "Ibitirama", "Divino de São Lourenço", "Dores do Rio Preto",
  "Conceição do Castelo", "Brejetuba",
];

const MAQUINAS = [
  { modelo: "T7", categoria: "trator", descricao: "Trator de alta potência (180-300 cv), ideal para grandes lavouras.", curiosidades: "Transmissão Auto Command™ com variação contínua — mais economia de combustível." },
  { modelo: "T6", categoria: "trator", descricao: "Trator versátil de média potência para pecuária e lavoura.", curiosidades: "Cabine Horizon™ com visibilidade panorâmica de 360°." },
  { modelo: "TL5", categoria: "trator", descricao: "Trator robusto e econômico (75-90 cv), o queridinho do produtor.", curiosidades: "Motor FPT com baixíssimo consumo e manutenção simples." },
  { modelo: "TT4", categoria: "trator", descricao: "Trator compacto e ágil para café e fruticultura.", curiosidades: "Perfeito para o relevo montanhoso do sul do ES e cafezais." },
  { modelo: "CR", categoria: "colheitadeira", descricao: "Colheitadeira axial de alta capacidade.", curiosidades: "Sistema Twin Rotor™ com a melhor qualidade de grãos do mercado." },
  { modelo: "W170", categoria: "pa-carregadeira", descricao: "Pá carregadeira potente para construção e mineração.", curiosidades: "Braço Z-bar com força de arranque líder de categoria." },
  { modelo: "B95", categoria: "retroescavadeira", descricao: "Retroescavadeira robusta para obras e infraestrutura.", curiosidades: "Sistema Power Boost que aumenta a força de escavação." },
];

const NOMES = [
  "João Batista Ferreira", "Antônio Carlos Souza", "Sebastião Oliveira",
  "Maria das Graças Lima", "José Roberto Pereira", "Geraldo Magela Costa",
  "Fazenda Santa Luzia", "Cooperativa Agro Sul", "Construtora Vale Verde",
  "Pedro Henrique Almeida",
];

async function main() {
  console.log("🌱 Semeando banco...");

  // Municípios
  for (const nome of MUNICIPIOS) {
    await db.municipio.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  const municipios = await db.municipio.findMany();

  // Máquinas
  for (const m of MAQUINAS) {
    await db.maquina.upsert({ where: { modelo: m.modelo }, update: m, create: m });
  }

  // Estilo de fala inicial
  const estilo = await db.estiloDeFala.findFirst();
  if (!estilo) {
    await db.estiloDeFala.create({
      data: {
        guia: "Tom cordial, caloroso e direto, com sotaque regional do sul do ES. Usa saudações ('Bom dia, meu amigo!'), foca nos benefícios práticos da máquina e sempre puxa para marcar a visita. Usa poucos emojis (🚜👍).",
      },
    });
  }

  // Metas
  const metasExistentes = await db.meta.count();
  if (metasExistentes === 0) {
    await db.meta.createMany({
      data: [
        { tipo: "diaria", rotulo: "Conversas com clientes (hoje)", alvo: 10, progresso: 6, periodo: "diaria" },
        { tipo: "prospeccao", rotulo: "Novos prospects (semana)", alvo: 15, progresso: 9, periodo: "semanal" },
        { tipo: "negocios_banco", rotulo: "Negócios em banco (mês)", alvo: 8, progresso: 3, periodo: "mensal" },
        { tipo: "mensal", rotulo: "Máquinas vendidas (mês)", alvo: 5, progresso: 2, periodo: "mensal" },
        { tipo: "semanal", rotulo: "Visitas realizadas (semana)", alvo: 6, progresso: 4, periodo: "semanal" },
      ],
    });
  }

  // Clientes + Negociações de demonstração (idempotente por nome)
  const clientesExistentes = await db.cliente.count();
  if (clientesExistentes === 0) {
    const estagios = ["novo", "contato", "proposta", "negociacao", "fechamento"];
    const maquinas = MAQUINAS.map((m) => m.modelo);
    for (let i = 0; i < NOMES.length; i++) {
      const muni = municipios[i % municipios.length];
      const diasUltimoContato = [1, 3, 8, 0, 15, 2, 6, 20, 4, 11][i];
      const ultimoContato = new Date();
      ultimoContato.setDate(ultimoContato.getDate() - diasUltimoContato);

      const cliente = await db.cliente.create({
        data: {
          nome: NOMES[i],
          telefone: `2899${String(10000000 + i * 13).slice(0, 7)}`,
          municipioId: muni.id,
          origem: i % 2 === 0 ? "whatsapp" : "indicacao",
          jaComprou: i % 3 === 0,
          visitado: i % 2 === 0,
          perfilIA: i % 3 === 0 ? "Cliente fiel, já comprou antes." : "Produtor avaliando primeira máquina.",
        },
      });

      await db.negociacao.create({
        data: {
          clienteId: cliente.id,
          maquinaModelo: maquinas[i % maquinas.length],
          valor: [450000, 380000, 220000, 1200000, 180000, 520000, 290000, 760000, 410000, 195000][i],
          condicaoPagamento: ["financiamento", "consorcio", "avista", "financiamento", "avista"][i % 5],
          concorrenteMencionado: i % 4 === 0 ? "John Deere" : null,
          estagio: estagios[i % estagios.length],
          termometro: [80, 60, 40, 90, 30, 70, 50, 20, 65, 45][i],
          ultimoContato,
          proximaAcao: i % 2 === 0 ? "Enviar proposta atualizada" : "Ligar para confirmar visita",
          status: i === 7 ? "perdida" : "aberta",
          motivoPerda: i === 7 ? "Comprou da concorrência (preço)" : null,
        },
      });

      // Algumas tarefas no Kanban
      if (i < 5) {
        await db.tarefaKanban.create({
          data: {
            titulo: `Follow-up ${NOMES[i].split(" ")[0]}`,
            descricao: "Retomar negociação e enviar condições.",
            coluna: ["a_fazer", "fazendo", "a_fazer", "feito", "fazendo"][i],
            ordem: i,
            clienteId: cliente.id,
          },
        });
      }

      // Alerta de inatividade para quem está há muito tempo sem contato
      if (diasUltimoContato >= 8) {
        await db.alerta.create({
          data: {
            clienteId: cliente.id,
            tipo: "sem_resposta",
            mensagem: `${NOMES[i].split(" ")[0]} está há ${diasUltimoContato} dias sem resposta.`,
            diasDesde: diasUltimoContato,
            severidade: diasUltimoContato >= 15 ? "alta" : "media",
          },
        });
      }
    }
  }

  // Sugestões de vínculo (estilo Google Fotos)
  const sugExistentes = await db.sugestaoVinculo.count();
  if (sugExistentes === 0) {
    const cliente = await db.cliente.findFirst();
    await db.sugestaoVinculo.createMany({
      data: [
        { telefone: "28998887766", nomeDetectado: "Zé do Trator", textoContexto: "Bom dia, é o Zé, queria saber da TL5", confianca: 72, clienteId: cliente?.id },
        { telefone: "28997776655", nomeDetectado: null, textoContexto: "Oi, vi seu anúncio da colheitadeira", confianca: 45 },
      ],
    });
  }

  // Posts de mídia
  const midiaExistente = await db.midiaPost.count();
  if (midiaExistente === 0) {
    const maquinaT7 = await db.maquina.findUnique({ where: { modelo: "T7" } });
    await db.midiaPost.create({
      data: {
        maquinaId: maquinaT7?.id,
        titulo: "Você conhece a New Holland T7?",
        conteudo: "🚜 Potência de até 300cv com a economia da transmissão Auto Command™! A T7 é a escolha de quem quer produtividade no campo. Me chama que eu te conto as condições! 👇",
        status: "agendado",
        agendadoPara: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      },
    });
  }

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
