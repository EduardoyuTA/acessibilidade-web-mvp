# AcessoClaro

Protótipo acadêmico navegável do MVP. Não executa varreduras reais nem certifica acessibilidade.

[Demonstração atual](https://acessibilidade-web-mvp.janadaquino.chatgpt.site) · [Documentação](docs/README.md) · [Pesquisa e evidências](docs/PESQUISA.md) · [Backlog](docs/ROADMAP.md) · [Contribuir](CONTRIBUTING.md)

Projeto de Sistemas de Informação, CEUNI FAMETRO. Autores: Eduardo Victor da Silva Costa e Tcharllyson Coelho França. Orientação: Professora Luana Leal.

## Estrutura do repositório

```text
.github/      Verificação automática e modelos de tarefas/revisões
.openai/      Configuração da hospedagem existente
docs/         Requisitos, arquitetura, testes, operação e decisões
scripts/      Preparação do pacote de hospedagem
src/          App.tsx, app.css e main.jsx
tests/        Testes de hospedagem
worker/       Entrega dos arquivos estáticos
backend/      API Node.js, Playwright, axe-core e testes de segurança
vercel.json   Build, rotas e cabeçalhos do futuro front-end na Vercel
```

A primeira versão da API de análise está em `backend/`. Ela valida o destino, abre a página com Playwright e executa axe-core. O banco remoto ainda não existe; o histórico permanece no navegador. O código principal da interface permanece em App.tsx e sua modularização está no backlog.

## Executar

Pré-requisito: Node.js 22 com npm. Clone o repositório público e abra um terminal na pasta:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Abra http://127.0.0.1:5173/. Para compilar: `npm.cmd run build`.

Para compilar e rodar os testes da interface: `npm run check`. Para testar a API: entre em `backend`, execute `npm ci` e `npm test`. Para conferir o build local: `npm run preview -- --host 127.0.0.1`. O modo simulado funciona sem `.env`; `VITE_API_BASE_URL` ativa a análise real e deve apontar para a API do Render.

## Percurso

1. Informe uma URL pública completa e escolha um cenário simulado.
2. Consulte achados com impacto, regra, elemento, evidência e orientação.
3. Registre respostas e observações no checklist manual.
4. Consulte o relatório e use a impressão do navegador para salvar em PDF.
5. Reabra avaliações pelo Histórico.

Os registros ficam no armazenamento local deste navegador. Não há servidor de análise, conta, sincronização ou banco remoto. A validação de URL é ilustrativa e não substitui proteção de rede no backend. Não insira informações sensíveis.

## Verificação realizada

Compilação aprovada; testados no navegador: campo vazio, processamento simulado, resultados com achados, preenchimento de checklist, exibição no relatório e recuperação do histórico após recarregar. Mantido um registro de teste de example.com, explicitamente identificado como teste.

A API foi verificada com `https://example.com`: axe-core 4.14.0 executou a análise e devolveu achados, aprovações e itens inconclusivos. Também foram aprovados testes de bloqueio de endereços privados/reservados, contrato da API e CORS. Pendentes: implantação no Render/Vercel, testes completos dos demais cenários, impressão em PDF, leitor de tela e refinamento visual comparativo. Consulte [plano de testes](docs/TESTES.md).

## Desenvolvimento em dupla

Registrar tarefa, criar branch curta, implementar, testar e abrir pull request para revisão. Consulte [CONTRIBUTING.md](CONTRIBUTING.md). A política de revisão é proposta; proteção de branch não foi configurada automaticamente.

## Hospedagem e segurança

Arquitetura de publicação escolhida para o produto: **Vercel no front-end e Render no back-end**. A demonstração anterior continua no Sites até a primeira publicação verificada na Vercel. A CI executa build e testes, mas **não publica automaticamente** em nenhuma dessas plataformas. Consulte [operação](docs/OPERACAO.md) e [segurança](SECURITY.md).

PDFs pessoais, matrículas, respostas individuais e credenciais não devem ser versionados. A documentação acadêmica permanece no acervo local do TCC. A licença do código ainda deve ser definida pelos autores; nenhuma licença aberta foi atribuída automaticamente.
