# Histórico de mudanças

## Não lançado - correções, modularização e testes

- Correção do uso de `response.ok` na integração do front-end com a API real.
- Correção da preservação do aviso de falha do `localStorage` ao concluir avaliação (`CT09`).
- Correção da hierarquia de cabeçalhos (`h2`) na tela de Histórico (zero violações no `axe-core` em todas as telas da interface).
- Extração das regras de validação, persistência e estado para `src/evaluation.mjs` e suporte a filtros dinâmicos (`Moderado`, `Leve`) e contagem de ocorrências.
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
