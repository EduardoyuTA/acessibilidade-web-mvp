// Aplica o tema escolhido antes da primeira pintura, para a página não abrir
// clara e escurecer em seguida. Sem escolha salva, vale o tema do sistema.
(function () {
  try {
    var theme = window.localStorage.getItem("acessoclaro-tema");
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {
    /* armazenamento indisponível: segue o sistema */
  }
})();
