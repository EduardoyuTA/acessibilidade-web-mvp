# Histórico de mudanças

## Não lançado - correções, modularização e testes

- Adição do gráfico interativo de `% de acessibilidade` (SVG circular + barras de progresso de análise automática, conformidade manual e cobertura do checklist) na aba de Relatório.
- Controles interativos na aba de Relatório (alternância de visão do gráfico, filtro por status e atualização rápida de itens da inspeção manual com recálculo em tempo real), no Checklist (barra de progresso ao vivo e filtro de pendentes/revisados), nos Resultados (expandir/recolher todos e copiar orientação) e no Histórico (atalho direto ao relatório com `%` e remoção de avaliação).
- Correção do uso de `response.ok` na integração do front-end com a API real.
- Correção da preservação do aviso de falha do `localStorage` ao concluir avaliação (`CT09`).
- Correção da hierarquia de cabeçalhos (`h2`) na tela de Histórico (zero violações no `axe-core` em todas as telas da interface).
- Extração das regras de validação, persistência e estado para `src/evaluation.mjs` e suporte a filtros dinâmicos (`Moderado`, `Leve`) e contagem de ocorrências.
- Segurança da API (SSRF): o `page.route` do Playwright não intercepta os saltos de redirecionamento, o que permitia a um site público redirecionar o analisador para redes internas ou metadados da nuvem. Todo o tráfego do navegador agora passa por um proxy de saída (`egress-proxy.mjs`) que valida e fixa o IP de cada conexão, cobrindo redirecionamentos, `fetch` da página e DNS rebinding. Páginas com certificado HTTPS inválido deixam de ser abertas (`ignoreHTTPSErrors` removido). Testes com navegador real em `npm run test:browser`.
- Modo escuro: segue o tema do sistema e pode ser escolhido pelo botão do cabeçalho (escolha salva no navegador e aplicada antes da primeira pintura por `public/theme-init.js`). Cores fixas viraram variáveis em `src/styles.css`, com paleta escura própria; o texto sobre preenchimentos fortes usa `--on-accent` para manter o contraste. axe-core sem violações em todas as telas no modo escuro.
- Análise mais rápida em portais pesados (ex.: sites municipais que estouravam o tempo no Render): o conteúdo de iframes (widgets, vídeos, mapas), rastreadores, widgets de redes sociais e folhas de fontes de terceiros deixam de ser carregados, e o axe-core analisa só o documento principal. Localmente, um portal municipal caiu de 8,8 s para 4,2 s com os mesmos achados da página. O tempo limite passou para 90 s (`ANALYSIS_TIMEOUT_MS`); a resposta traz o tempo de cada etapa (`timings`), o erro de tempo esgotado diz em que etapa parou e a tela de análise mostra o tempo decorrido.
- Tela de boas-vindas (`#/boas-vindas`), exibida ao abrir o app: avaliação rápida direto pela URL, demonstração animada de uma página sendo analisada (marcadores clicáveis com o problema e a correção, com botão de pausa), simulador de percepção (baixa visão, daltonismo por deuteranopia e monocromático), "como funciona" e dados do IBGE (PNAD Contínua 2022) e da OMS (2022). Opção "Mostrar esta tela ao abrir o app".
- Achados automáticos viraram um guia de correção: para as regras mais comuns do axe-core, cada achado traz por que importa, quem é afetado, passos e código antes/depois (`src/fixGuides.mjs`), em abas acessíveis (Entenda, Como corrigir, Elementos). Ganho de cada correção no índice, ordenação por maior ganho, distribuição por gravidade clicável e plano de correção com índice projetado ("Marcar como corrigido", salvo na avaliação como `fixPlan`; o índice oficial não muda).
- Inspeção manual com modo guiado: um critério por vez, categorias com progresso, passos práticos marcáveis, link para abrir a página avaliada, avanço automático ao responder (opcional), navegação por pontos, painel com progresso e índice ao vivo e tela de conclusão. O modo lista continua disponível.
- `App.tsx` dividido: componentes em `src/components/` (guia de achados, inspeção, boas-vindas, abas, ícones, número animado) e tipos em `src/types.ts`.
- Redesign "Sinal claro" para desktop e mobile, a partir do canvas do Claude Design: fonte Atkinson Hyperlegible (hospedada no próprio site), cartões e nova paleta, etapas em barra horizontal, navegação inferior fixa no celular, opções do checklist em blocos grandes com selo de status, achados com faixa de gravidade, avisos flutuantes que somem sozinhos e barra contínua durante a análise real. Animações suaves (entrada de tela, abrir achados, índice e barras, selos, avisos), todas desligadas com "reduzir movimento". Os estilos foram reunidos em `src/styles.css`, substituindo `app.css` (minificado) e `improvements.css`. axe-core sem violações em todas as telas, em 375 px e 1366 px.
- Navegação por endereço: cada tela tem seu endereço (`#/historico`, `#/ajuda`, `#/avaliacao/<id>`, `.../checklist`, `.../relatorio`), então voltar/avançar do navegador, recarregar e links diretos funcionam; voltar durante a análise a cancela. O título da aba acompanha a tela. As observações do checklist são gravadas após uma pausa na digitação (e ao sair da tela ou fechar a página), em vez de a cada tecla, sem repetir o aviso para leitores de tela. O link "Ir para o conteúdo" move o foco sem alterar o endereço.
- Checklist manual ampliado de 6 para 14 itens, cobrindo critérios WCAG que a automação não julga (finalidade de links, legendas e transcrições, mensagens de erro, uso de cor, conteúdo em movimento e flashes, tempo ajustável, cabeçalhos e rótulos, refluxo). Cada item mostra o critério WCAG e uma orientação "Como verificar". Avaliações salvas antes da mudança continuam com os 6 itens originais (`checklistSize`).
- Índice automático mais preciso: regras que falham em muitos elementos pesam mais (1 ocorrência = 1x, 10 = 1,5x, 100+ = 2x). Cada achado mostra até 5 elementos afetados com seletor CSS. Os pontos que o axe-core não consegue decidir (`incomplete`) passam a aparecer em "Para conferir manualmente", nos resultados e no relatório, sem entrar no índice.
- API: no tempo limite (agora `504`) ou quando o cliente cancela, a análise é de fato interrompida (fechando o contexto do navegador) e a vaga só é liberada quando ela termina, evitando duas análises simultâneas. Limite de análises por IP (padrão: 10 a cada 10 minutos, configurável por `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`) com cabeçalho `Retry-After`.
- Tratamento amigável para falhas de resolução DNS e garantia de fechamento do navegador no backend.
- Ampliação dos testes automatizados do front-end (`CT01`–`CT09` e API) e do back-end (erros `400`, limite `429` e DNS).

## Não lançado - identidade e fundamentação

- Arquitetura de publicação definida: Vercel no front-end e Render no back-end.
- Configuração inicial da Vercel e exemplo da URL da futura API adicionados.
- Responsabilidades, contrato inicial e controles de segurança do backend documentados.
- API real criada com Express, Playwright e axe-core.
- Bloqueio de URLs privadas/reservadas, CORS e limites operacionais adicionados.
- Interface preparada para alternar automaticamente entre análise real e demonstração.
- Teste real concluído com example.com e axe-core 4.14.0.
- Nome do projeto atualizado para AcessoClaro no README.
- Nome AcessoClaro aplicado ao título do navegador e à interface.
- Rótulos estruturais e avisos dinâmicos aprimorados para tecnologias assistivas.
- Navegação móvel, alvos de toque e ações do relatório refinados.
- Três testes de contrato adicionados para identidade, acessibilidade estrutural e responsividade.
- Plano de validação criado para teclado, leitor de tela, ampliação e teste com participantes.
- Situação pública do repositório documentada corretamente.
- Inclusão das evidências utilizadas na apresentação de pré-banca.
- Registro explícito das limitações da pesquisa de aceitação com 18 respostas.

## Não lançado - organização do repositório

- README, documentação técnica, backlog, operação e decisões.
- Guias de contribuição e segurança.
- CI, modelos de issues/PRs e comando `npm run check`.
- Remoção de arquivos do starter sem uso: `src/App.jsx` e `src/styles.css`.

Não adiciona análise real nem altera o site publicado.

## Base anterior

Protótipo React com resultados simulados, checklist, histórico local e relatório. Publicação no Sites e código privado no GitHub.
