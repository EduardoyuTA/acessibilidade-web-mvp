# Operação e publicação

Usar Node.js 22 e `npm ci`. Para desenvolver: `npm run dev -- --host 127.0.0.1`. O protótipo não precisa de `.env`, banco remoto ou chaves de API.

`npm run check` compila e testa. A CI usa o mesmo comando em Linux em pushes para `main` e pull requests. Ela tem permissão somente de leitura do código e não publica o site.

O build produz `dist/client`, `dist/server/index.js` e `dist/.openai/hosting.json`. Preservar Worker, empacotamento e identificador da hospedagem. O `project_id` não é senha, mas tokens nunca devem entrar em arquivos, remotes ou commits.

Publicação é uma operação separada no Sites. Um push ao GitHub não significa atualização do site público. Reutilizar o site existente nas manutenções.

Em regressões, identificar o commit responsável e preferir reversão revisada a reescrever `main`. Testar e publicar separadamente a correção.

Os dados ficam no navegador. Não há backup ou recuperação central; localhost e domínio público possuem históricos separados. Não inserir informações sensíveis.
