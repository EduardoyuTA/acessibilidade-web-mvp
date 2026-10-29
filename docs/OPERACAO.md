# Operação e publicação

Usar Node.js 22 e `npm ci`. Para desenvolver: `npm run dev -- --host 127.0.0.1`. O protótipo simulado não precisa de `.env`, banco remoto ou chaves de API.

`npm run check` compila e testa. A CI usa o mesmo comando em Linux em pushes para `main` e pull requests. A publicação é feita pelas integrações do GitHub com Vercel e Render após o envio à branch configurada.

O build produz `dist/client`, `dist/server/index.js` e `dist/.openai/hosting.json`. Preservar Worker, empacotamento e identificador da hospedagem. O `project_id` não é senha, mas tokens nunca devem entrar em arquivos, remotes ou commits.

## Arquitetura de publicação escolhida

- **Vercel:** front-end React/Vite, com build `npm run build` e saída `dist/client`.
- **Render:** API Node.js responsável pela validação segura da URL, Playwright e axe-core.
- **GitHub:** fonte do código e integração com as duas plataformas.

Na Vercel, o projeto está conectado a este repositório, com a raiz na raiz do repositório. O arquivo `vercel.json` informa o build, a pasta de saída, o fallback da aplicação e cabeçalhos básicos. `VITE_API_BASE_URL` deve permanecer cadastrado nos ambientes de produção e preview com o endereço HTTPS do Render e sem barra final.

No Render, o backend é publicado como Web Service separado e aceita o endereço oficial da Vercel como origem. A rota `/health` responde sem iniciar o navegador; a análise real fica em `/api/analyze`. Nenhuma credencial deve ser gravada no repositório.

Um push em `main` aciona as integrações de implantação configuradas. Após cada envio, conferir o estado dos dois serviços e repetir o fluxo real antes de considerar a versão aprovada.

Se for usado o plano gratuito do Render, considerar a suspensão por inatividade e o atraso da primeira requisição no roteiro da apresentação. Para a pré-banca, abrir o sistema e executar uma verificação de saúde com antecedência.

Em regressões, identificar o commit responsável e preferir reversão revisada a reescrever `main`. Testar e publicar separadamente a correção.

Mesmo com o backend de análise, os dados e o histórico ficam no navegador. Não há backup ou recuperação central; localhost e cada domínio público possuem históricos separados. Não inserir informações sensíveis.
