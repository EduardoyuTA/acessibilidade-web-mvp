# Segurança

O modo demonstrativo não busca páginas externas. A API real valida protocolo, credenciais, porta e resolução DNS; bloqueia redes internas/reservadas. Todo o tráfego do navegador da análise passa por um proxy de saída interno (`backend/src/egress-proxy.mjs`), que resolve o DNS, recusa IPs privados/reservados e portas diferentes de 80/443 e conecta exatamente no IP validado; isso cobre redirecionamentos em qualquer salto, requisições feitas por scripts da página e DNS rebinding. Certificados HTTPS inválidos não são aceitos. Há limites de corpo, tempo e concorrência. Esses controles reduzem risco de SSRF, mas a implantação também deve isolar o serviço e restringir sua rede de saída sempre que a plataforma permitir.

O localStorage não é um cofre. Não inserir credenciais, URLs com tokens ou dados sensíveis em observações. Definir acesso e retenção antes de persistência remota.

Relatar vulnerabilidades ao mantenedor por canal privado acordado. Se o reporte privado estiver disponível na aba Security, ele pode ser utilizado; sua ativação não é pressuposta aqui. Não publicar segredos ou detalhes sensíveis em issues.

Se uma credencial vazar, revogá-la/rotacioná-la com o responsável: excluir o arquivo não remove o segredo do histórico.
