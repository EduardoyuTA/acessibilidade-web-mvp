/**
 * Guias de correção por regra do axe-core: por que importa, quem é afetado,
 * passos práticos e um exemplo de código antes/depois. Regras sem guia
 * próprio recebem um guia genérico montado a partir do achado.
 */
import { ruleIdOf } from "./evaluation.mjs";

export const AUDIENCES = {
  screenReader: "Leitor de tela",
  keyboard: "Só teclado",
  lowVision: "Baixa visão",
  colorBlind: "Daltonismo",
  cognitive: "Cognição e leitura",
  motor: "Mobilidade reduzida",
  deaf: "Surdez"
};

export const FIX_GUIDES = {
  "image-alt": {
    why: "Quem usa leitor de tela ouve só \"imagem\" ou o nome do arquivo e perde a informação que a imagem transmite.",
    audiences: ["screenReader", "lowVision"],
    steps: [
      "Descubra o que a imagem comunica naquele contexto.",
      "Escreva isso em poucas palavras no atributo alt.",
      "Se a imagem for só decorativa, use alt vazio (alt=\"\") para o leitor de tela ignorá-la."
    ],
    before: '<img src="banner.jpg">',
    after: '<img src="banner.jpg" alt="Inscrições abertas até 30 de novembro">'
  },
  "input-image-alt": {
    why: "Um botão feito de imagem sem texto alternativo não diz o que faz.",
    audiences: ["screenReader"],
    steps: [
      "Dê ao botão de imagem um alt que descreva a ação, não a figura."
    ],
    before: '<input type="image" src="lupa.svg">',
    after: '<input type="image" src="lupa.svg" alt="Buscar">'
  },
  "image-redundant-alt": {
    why: "O leitor de tela lê a mesma informação duas vezes seguidas, o que cansa e confunde.",
    audiences: ["screenReader", "cognitive"],
    steps: [
      "Se o texto ao lado já diz o mesmo que a imagem, deixe o alt vazio.",
      "Ou reescreva o alt para acrescentar algo que o texto não diz."
    ],
    before: '<img src="joao.jpg" alt="João Silva"> João Silva',
    after: '<img src="joao.jpg" alt=""> João Silva'
  },
  label: {
    why: "Sem rótulo, quem usa leitor de tela não sabe o que digitar, e o clique no texto não leva ao campo.",
    audiences: ["screenReader", "cognitive", "motor"],
    steps: [
      "Adicione um <label> visível para cada campo.",
      "Ligue o rótulo ao campo com for=\"…\" igual ao id do campo.",
      "Não use só o placeholder: ele some quando a pessoa começa a digitar."
    ],
    before: '<input id="email" placeholder="E-mail">',
    after: '<label for="email">E-mail</label>\n<input id="email" type="email">'
  },
  "select-name": {
    why: "Uma lista de opções sem nome não diz o que está sendo escolhido.",
    audiences: ["screenReader"],
    steps: ["Associe um <label> ao <select> com for e id."],
    before: '<select id="uf">…</select>',
    after: '<label for="uf">Estado</label>\n<select id="uf">…</select>'
  },
  "color-contrast": {
    why: "Texto com pouco contraste fica ilegível para pessoas com baixa visão e para todos sob sol forte.",
    audiences: ["lowVision", "colorBlind"],
    steps: [
      "Meça o contraste entre texto e fundo (ex.: verificador de contraste do navegador).",
      "Texto comum precisa de 4,5:1; texto grande (24 px, ou 18,5 px em negrito), de 3:1.",
      "Escureça o texto ou clareie o fundo até passar."
    ],
    before: ".aviso { color: #9aa5b1; background: #ffffff; } /* 2,6:1 */",
    after: ".aviso { color: #4a5b70; background: #ffffff; } /* 6,9:1 */"
  },
  "button-name": {
    why: "O leitor de tela anuncia só \"botão\", sem dizer o que ele faz. Comum em botões só com ícone.",
    audiences: ["screenReader"],
    steps: [
      "Dê ao botão um texto visível, ou",
      "Se ele for só um ícone, adicione aria-label com a ação.",
      "Marque o ícone com aria-hidden=\"true\"."
    ],
    before: '<button><i class="icone-lupa"></i></button>',
    after: '<button aria-label="Buscar">\n  <i class="icone-lupa" aria-hidden="true"></i>\n</button>'
  },
  "link-name": {
    why: "Um link sem texto é anunciado só como \"link\", e a pessoa não sabe para onde ele leva.",
    audiences: ["screenReader", "keyboard"],
    steps: [
      "Coloque texto dentro do link, ou",
      "Se o link for uma imagem, dê à imagem um alt que diga o destino."
    ],
    before: '<a href="/inicio"><img src="logo.svg"></a>',
    after: '<a href="/inicio"><img src="logo.svg" alt="Página inicial"></a>'
  },
  "html-has-lang": {
    why: "Sem o idioma declarado, o leitor de tela pode ler o português com pronúncia de outra língua.",
    audiences: ["screenReader", "cognitive"],
    steps: ["Declare o idioma da página na tag <html>."],
    before: "<html>",
    after: '<html lang="pt-BR">'
  },
  "html-lang-valid": {
    why: "Um código de idioma inválido tem o mesmo efeito de não declarar idioma.",
    audiences: ["screenReader"],
    steps: ["Use um código válido, como pt-BR ou en."],
    before: '<html lang="portugues">',
    after: '<html lang="pt-BR">'
  },
  "document-title": {
    why: "O título da aba é a primeira coisa que o leitor de tela anuncia e ajuda a achar a página entre várias abas.",
    audiences: ["screenReader", "cognitive"],
    steps: ["Dê à página um <title> que descreva o conteúdo e o site."],
    before: "<title></title>",
    after: "<title>Contato | Prefeitura de Exemplo</title>"
  },
  region: {
    why: "Conteúdo fora das regiões (cabeçalho, navegação, principal, rodapé) fica difícil de alcançar por quem navega por regiões.",
    audiences: ["screenReader", "keyboard"],
    steps: [
      "Organize a página com <header>, <nav>, <main> e <footer>.",
      "Garanta que todo o conteúdo visível esteja dentro de uma dessas regiões."
    ],
    before: '<div class="topo">…</div>\n<div class="conteudo">…</div>',
    after: "<header>…</header>\n<main>…</main>"
  },
  "landmark-one-main": {
    why: "Sem uma região principal, quem usa leitor de tela não consegue pular direto para o conteúdo.",
    audiences: ["screenReader", "keyboard"],
    steps: ["Envolva o conteúdo principal da página em um único <main>."],
    before: '<div id="conteudo">…</div>',
    after: '<main id="conteudo">…</main>'
  },
  "landmark-unique": {
    why: "Regiões repetidas com o mesmo nome confundem a navegação por regiões.",
    audiences: ["screenReader"],
    steps: ["Dê nomes diferentes às regiões do mesmo tipo com aria-label."],
    before: "<nav>…</nav>\n<nav>…</nav>",
    after: '<nav aria-label="Principal">…</nav>\n<nav aria-label="Rodapé">…</nav>'
  },
  "landmark-no-duplicate-banner": {
    why: "Dois cabeçalhos de página confundem quem navega por regiões.",
    audiences: ["screenReader"],
    steps: ["Mantenha um único <header> no nível da página; cabeçalhos internos ficam dentro de <section> ou <article>."],
    before: "<header>…</header>\n<header>…</header>",
    after: "<header>…</header>\n<section><header>…</header></section>"
  },
  "landmark-banner-is-top-level": {
    why: "O cabeçalho da página dentro de outra região deixa de ser reconhecido como cabeçalho principal.",
    audiences: ["screenReader"],
    steps: ["Tire o <header> da página de dentro de outras regiões, como <main>."],
    before: "<main><header>…</header></main>",
    after: "<header>…</header>\n<main>…</main>"
  },
  "page-has-heading-one": {
    why: "O título principal (h1) diz do que trata a página e é atalho comum para leitores de tela.",
    audiences: ["screenReader", "cognitive"],
    steps: ["Adicione um <h1> com o assunto principal da página."],
    before: '<div class="titulo">Serviços</div>',
    after: "<h1>Serviços</h1>"
  },
  "heading-order": {
    why: "Pular níveis de título (h2 → h4) quebra o sumário que o leitor de tela monta da página.",
    audiences: ["screenReader", "cognitive"],
    steps: [
      "Use os níveis em sequência: h1, depois h2, depois h3.",
      "Escolha o nível pela hierarquia, não pelo tamanho da fonte (ajuste o tamanho no CSS)."
    ],
    before: "<h2>Serviços</h2>\n<h4>Saúde</h4>",
    after: "<h2>Serviços</h2>\n<h3>Saúde</h3>"
  },
  "empty-heading": {
    why: "Um título vazio é anunciado como título sem conteúdo e polui a navegação.",
    audiences: ["screenReader"],
    steps: ["Coloque texto no título ou troque a tag por um elemento que não seja título."],
    before: "<h2></h2>",
    after: "<h2>Notícias</h2>"
  },
  list: {
    why: "Listas mal formadas perdem o anúncio \"lista com N itens\" que orienta quem usa leitor de tela.",
    audiences: ["screenReader"],
    steps: ["Dentro de <ul> e <ol>, use apenas <li> como filhos diretos."],
    before: "<ul><div>Item</div></ul>",
    after: "<ul><li>Item</li></ul>"
  },
  listitem: {
    why: "Um <li> fora de uma lista não é anunciado como item de lista.",
    audiences: ["screenReader"],
    steps: ["Coloque os <li> dentro de um <ul> ou <ol>."],
    before: "<div><li>Item</li></div>",
    after: "<ul><li>Item</li></ul>"
  },
  "aria-valid-attr-value": {
    why: "Um valor ARIA inválido faz o leitor de tela anunciar algo errado ou ignorar o elemento.",
    audiences: ["screenReader"],
    steps: [
      "Confira o valor do atributo ARIA na especificação.",
      "Atributos que apontam para id (aria-labelledby, aria-controls) precisam de um id que exista."
    ],
    before: '<button aria-expanded="sim">Menu</button>',
    after: '<button aria-expanded="false">Menu</button>'
  },
  "aria-hidden-focus": {
    why: "Um elemento escondido do leitor de tela mas ainda focável leva o foco para \"lugar nenhum\".",
    audiences: ["screenReader", "keyboard"],
    steps: [
      "Não esconda com aria-hidden elementos que recebem foco.",
      "Se precisar esconder, tire-os da ordem de Tab (tabindex=\"-1\") ou use inert."
    ],
    before: '<div aria-hidden="true"><a href="/x">Link</a></div>',
    after: '<div aria-hidden="true" inert><a href="/x">Link</a></div>'
  },
  "label-content-name-mismatch": {
    why: "Quem usa comando de voz fala o texto que vê; se o nome acessível for diferente, o comando não funciona.",
    audiences: ["motor", "screenReader"],
    steps: ["Faça o aria-label começar pelo texto visível do controle."],
    before: '<button aria-label="Enviar formulário de contato">Enviar mensagem</button>',
    after: '<button aria-label="Enviar mensagem de contato">Enviar mensagem</button>'
  },
  "target-size": {
    why: "Alvos pequenos ou colados são difíceis de acertar com o dedo ou com tremor nas mãos.",
    audiences: ["motor", "lowVision"],
    steps: ["Deixe botões e links com pelo menos 24×24 px (ideal 44×44) ou com espaço livre ao redor."],
    before: ".icone-btn { width: 16px; height: 16px; }",
    after: ".icone-btn { min-width: 44px; min-height: 44px; }"
  },
  "frame-title": {
    why: "Um iframe sem título é anunciado só como \"quadro\", sem dizer o que contém.",
    audiences: ["screenReader"],
    steps: ["Dê ao iframe um title que descreva o conteúdo."],
    before: '<iframe src="mapa.html"></iframe>',
    after: '<iframe src="mapa.html" title="Mapa de localização da sede"></iframe>'
  },
  "meta-viewport": {
    why: "Bloquear o zoom impede pessoas com baixa visão de ampliar a página no celular.",
    audiences: ["lowVision"],
    steps: ["Remova user-scalable=no e maximum-scale da meta viewport."],
    before: '<meta name="viewport" content="width=device-width, user-scalable=no">',
    after: '<meta name="viewport" content="width=device-width, initial-scale=1">'
  },
  "nested-interactive": {
    why: "Um controle dentro de outro (link dentro de botão) confunde o foco e o anúncio do leitor de tela.",
    audiences: ["screenReader", "keyboard"],
    steps: ["Separe os controles: um não pode ficar dentro do outro."],
    before: '<button>Comprar <a href="/info">info</a></button>',
    after: '<button>Comprar</button>\n<a href="/info">Mais informações</a>'
  },
  "link-in-text-block": {
    why: "Links diferenciados só pela cor somem para quem tem daltonismo.",
    audiences: ["colorBlind", "lowVision"],
    steps: ["Mantenha o sublinhado nos links dentro de textos (ou outro sinal além da cor)."],
    before: "p a { text-decoration: none; color: #1e56cf; }",
    after: "p a { text-decoration: underline; color: #1e56cf; }"
  }
};

/** Guia da regra do achado, com reserva genérica para regras sem guia. */
export function guideFor(finding) {
  const id = ruleIdOf(finding);
  const guide = FIX_GUIDES[id];
  if (guide) return { id, generic: false, ...guide };
  return {
    id,
    generic: true,
    why: finding?.evidence || "",
    audiences: [],
    steps: [finding?.fix || "Consulte a documentação da regra."].filter(Boolean),
    before: "",
    after: ""
  };
}
