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

`src/main.jsx` importa `App.tsx` e `app.css`. A lógica está concentrada em `App.tsx`. Quando `VITE_API_BASE_URL` está vazio, a interface usa cenários simulados; quando configurado, envia a URL para a API. Não há banco remoto ou roteador com endereço próprio para cada tela. O Worker legado serve arquivos, não executa verificações de acessibilidade. TSX não implica typecheck: ainda falta configurar essa verificação.

## Requisitos e situação

| ID | Função | Estado |
|---|---|---|
| RF01 | Informar URL pública | Campo implementado |
| RF02 | Validar URL | Cliente + bloqueio de protocolo, credenciais, portas e redes privadas na API |
| RF03 | Carregar página com navegador automatizado | Implementado com Playwright; publicação pendente |
| RF04 | Executar análise automática | Implementado com axe-core; publicação pendente |
| RF05 | Apresentar achados detalhados | Dados reais quando a API está configurada; simulação como fallback explícito |
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

O contrato implementado possui `GET /health` para monitoramento e `POST /api/analyze` para receber uma URL pública e devolver situação, achados e limitações. A API bloqueia endereços privados, loopback, metadados de nuvem, protocolos diferentes de HTTP/HTTPS, portas alternativas e requisições internas feitas durante a navegação. Aplica limites de corpo, tempo e concorrência. A proteção é uma defesa em camadas para o MVP e não substitui isolamento de rede da infraestrutura.

Node.js/Express, Playwright e axe-core estão implementados em `backend/`. PostgreSQL permanece apenas no planejamento. Antes de histórico remoto, definir propriedade e isolamento dos dados, pois autenticação está fora do escopo atual. Não criar uma lista global que exponha avaliações de outras pessoas.

Cadastro, IA, correção automática, análise em lote, dashboard avançado e certificação ficam fora desta etapa. A modularização de App.tsx deve ser realizada com testes de regressão, sem criar pastas fictícias de serviços ainda inexistentes.
