# Roadmap do CRM DO EDY — Visão completa

> Documento vivo. Registra TUDO que foi pedido para o CRM, organizado em módulos,
> para construção em fases. Também serve como apresentação do projeto (caso a ideia
> seja vendida no futuro). Última atualização: 2026-06-21.

## Quem usa
Ederson — vendedor de máquinas pesadas **New Holland / Dynapac** no sul do Espírito
Santo. CRM pessoal, "vivo", com IA (Agnes) que lê conversas, entende o cliente,
conduz a negociação e ajuda a fechar vendas.

---

## ⚠️ Realidade técnica importante: Offline x IA

O pedido "o sistema precisa funcionar offline" é possível **em parte**:

- **Funciona offline (dados já salvos):** fichas técnicas, comparativos, banco de
  negociação, checklists de documentos, scripts de vendas, propostas prontas,
  pós-venda, frota do cliente. Tudo isso pode ser cacheado no celular/PC (PWA) e
  consultado **sem internet**.
- **Precisa de internet (IA):** ler/interpretar arquivos novos, transcrever áudios
  (.oga), gerar resumos, responder por mim, aprender meu jeito de falar. Isso roda
  na nuvem (API da Anthropic) — não tem como rodar offline no celular.

**Plano:** deixar todo o *conteúdo* disponível offline; as ações de IA ficam numa
fila e processam quando a internet voltar. Telas de consulta nunca dependem da net.

---

## Módulos

### A. Inteligência das Máquinas (base de conhecimento)
- **A1. Fichas técnicas — importar arquivos:** botão para subir datasheet, folheto
  técnico, comparativos, imagens, textos. A IA lê e **alimenta as informações
  técnicas** da máquina, mantendo dados fiéis (sem inventar). Fonte fica registrada.
- **A2. Banco de Negociação (por modelo):** valor inicial a passar ao cliente,
  diferenciais, argumentos, textos prontos de cada máquina, consumo (litros/h),
  KM/hora. Campo livre para adicionar argumentos e informações.
- **A3. Comparativos automáticos:**
  - Combustível: "a máquina do concorrente faz X litros a mais" → IA calcula quanto
    o cliente gasta a mais em **R$ por dia / semana / mês / ano**.
  - 🔔 **LEMBRETE (pegar dados com o Natã):** KM/hora e a diferença de **frete/saída**
    por venda nova até a cidade do cliente vs. saindo de Serra até o cliente.

### B. Importação e memória de conversas
- **B1. Importar histórico flexível:** aceitar **.zip / pastas compactadas** e
  **qualquer formato** de arquivo (mais usados: **HTML** e **OGA**), um ou vários de
  uma vez. A IA lê e absorve **tudo**.
- **B2. Áudios (.oga):** transcrição automática (precisa internet/IA).
- **B3. Extração de cadastro:** a IA puxa dados do cliente das conversas e preenche
  o cadastro. **Resumo da conversa aparece no cadastro do cliente.**
- **B4. Contatos:** adicionar automaticamente os contatos encontrados nas conversas.

### C. Agnes (assistente)
- **C1. Botão flutuante:** substituir o botão atual **mantendo o mesmo ícone**.
- **C2. Resumo sob demanda:** a Agnes resume cada conversa do WhatsApp quando eu pedir.
- **C3. Atendimento:** a IA responde por mim no WhatsApp (já existe — evoluir).

### D. Suporte IA do próprio CRM (admin, com auditoria)
- **D1. IA operadora do CRM:** consegue corrigir/criar/excluir **qualquer item
  interno** do CRM. Acesso total, **tudo registrado em auditoria** (quem/o quê/quando,
  com possibilidade de desfazer).
- **D2. Documentação do projeto:** espaço dentro do suporte com a construção do CRM
  (este roadmap + histórico), pronto para apresentar/vender a ideia.

### E. Academia de Vendas / Estudo da IA
- **E1. Aprende meu jeito:** IA estuda minhas conversas e aprende meu tom, minhas
  frases, os preços e contextos (modo "aprendiz" ligado nas conversas).
- **E2. Modo negociação agressiva:** quando ativo, a IA reformula minhas frases
  conforme o contexto e conduz o cliente do **primeiro contato até o fechamento** —
  "o melhor vendedor do mundo": contorna objeções e convence o cliente de que comigo
  é o melhor negócio da vida dele.
- **E3. Ensinar a IA:** campo onde eu escrevo **ou falo** informações para a IA
  aprender (consumo das máquinas, vantagens, etc.).
- **E4. Estrutura de conversa por modelo:** roteiro completo do 1º contato ao
  fechamento, com vários contextos, **objeções e respostas agressivas**, para **cada
  modelo de máquina**. Tudo inserido na Academia de Vendas.
- **E5. Método anti-fuga:** técnica inteligente para o cliente não sumir — negociação
  profissional de alto nível.

### F. Documentos e Financiamento
- **F1. Checklists de documentos:** Produtor Rural, Pessoa Física, Pessoa Jurídica.
- **F2. Propostas e financiamento:** modelos pré-prontos por máquina para banco
  próprio, **banco CNH** e o banco de relacionamento do cliente.
- **F3. Anexos:** espaço para anexar documentos e informações da negociação.

### G. Pós-venda
- **G1. Mensagem de parabéns** ao concluir a compra, com contatos do pós-venda:
  agendamento de revisões, problemas na máquina, vendedor de peças, mecânico.
- **G2. Setor Pós-venda** dentro do CRM.

### H. Cadastro e frota
- **H1. Frota New Holland do cliente:** o cadastro mostra as máquinas que ele tem.
  Ao concluir uma venda, a frota é **atualizada automaticamente** (ex.: passa a
  constar "1 escavadeira + 1 retro").

### I. Marketing
- **I1. Escolher a máquina** para a geração de conteúdo de marketing.

### J. Offline (PWA)
- Telas de consulta funcionam sem internet (ver Módulos A, E4, F, G). Ações de IA
  entram em fila e sincronizam quando a conexão voltar.

---

## Estado atual (já construído)
- WhatsApp/Atendimento com Z-API, SSE em tempo real, fotos dos contatos.
- Importação de histórico (Z-API e por arquivo .zip/.txt/.html).
- Agnes no back-end + controles na tela (ligar por conversa, rascunho/automático,
  categorias, ignorar, aprovar/editar/descartar rascunho).
- CRM base: clientes, pipeline, dashboard, máquinas, marketing, simulador, etc.

## Próximos passos
A ordem de construção será definida com o Ederson (ver conversa). Recomendação de
início: **Módulo A (Máquinas inteligentes)** — é a base que alimenta o modo vendedor
da IA (Módulo E) e as propostas (Módulo F).
