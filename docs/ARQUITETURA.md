# Arquitetura e requisitos

## Implementação atual

```text
Navegador
  React / Vite
    Estado de navegação e avaliação
    Exemplos fixos de achados
    localStorage (avaliações e respostas)
    Impressão do navegador
Sites / Worker: entrega dos arquivos estáticos
```

`src/main.jsx` importa `App.tsx` e `app.css`. A lógica está concentrada em `App.tsx`. Não há API de análise, banco remoto ou roteador com endereço próprio para cada tela. O Worker serve arquivos, não executa verificações de acessibilidade. TSX não implica typecheck: ainda falta configurar essa verificação.

## Requisitos e situação

| ID | Função | Estado |
|---|---|---|
| RF01 | Informar URL pública | Campo implementado |
| RF02 | Validar URL | Validação ilustrativa no cliente; segurança de rede pendente |
| RF03 | Carregar página com navegador automatizado | Simulado |
| RF04 | Executar análise automática | Exemplos fixos, sem axe-core |
| RF05 | Apresentar achados detalhados | Implementado com dados fictícios |
| RF06 | Inspeção manual | Seis itens, respostas e observações |
| RF07 | Salvar e recuperar avaliação | Histórico local |
| RF08 | Relatório | Visualização e impressão pelo navegador |

## Dados

`RecordItem`: `id`, `url`, `date`, `scenario`, `answers`. Cada resposta tem `value` e `note`, indexados pelo item. Chave local: `tcc-prototipo-v1`. Os achados são reconstruídos pelo cenário e não armazenados como evidência real por execução.

## Regras essenciais

- Uma página por avaliação, não varredura de domínio.
- Ausência de achados não comprova acessibilidade integral.
- Checklist parcial é permitido e o relatório conserva pendências.
- Respostas: Atende, Não atende, Não se aplica e Não verificado.
- Interrupções permanecem identificadas como incompletas.
- Simulação e observações humanas devem ser distinguíveis.
- Histórico local não é compartilhado entre dispositivos ou origens web.

## Evolução proposta

```text
Navegador
  Front-end React/Vite — Vercel
    URL, resultados, inspeção manual e relatório
      HTTPS/JSON
        API Node.js — Render
          validação de URL e proteção contra SSRF
          Playwright + axe-core
          normalização dos achados
```

A Vercel entregará a interface estática. O Render executará a API porque a análise real exige navegador automatizado e processo de servidor. A variável `VITE_API_BASE_URL` ligará as duas partes; o CORS do backend deverá aceitar apenas os endereços oficiais do front-end.

O contrato planejado começa com `GET /health` para monitoramento e `POST /api/analyze` para receber uma URL pública e devolver situação, achados e limitações. A API deve bloquear endereços privados, loopback, metadados de nuvem, protocolos diferentes de HTTP/HTTPS e redirecionamentos para destinos proibidos. Também deverá aplicar limite de tamanho, tempo de execução e quantidade de redirecionamentos.

Node.js/Express e PostgreSQL constam do planejamento, mas não foram implementados. Antes de histórico remoto, definir propriedade e isolamento dos dados, pois autenticação está fora do escopo atual. Não criar uma lista global que exponha avaliações de outras pessoas.

Cadastro, IA, correção automática, análise em lote, dashboard avançado e certificação ficam fora desta etapa. A modularização de App.tsx deve ser realizada com testes de regressão, sem criar pastas fictícias de serviços ainda inexistentes.
