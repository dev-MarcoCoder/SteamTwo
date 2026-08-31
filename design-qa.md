# SteamTwo — Design QA

## Evidências

- referência selecionada: `design-reference/dashboard-selected-blue.png`;
- implementação desktop: `design-reference/implementation-1440.png`;
- comparação lado a lado: `design-reference/comparison-reference-vs-implementation.png`;
- implementação móvel: `design-reference/implementation-mobile-390.png`;
- viewport desktop: 1440 × 1024 CSS pixels;
- viewport móvel solicitado: 390 × 844, renderizado pelo navegador integrado em 482 × 1042 CSS pixels por escala do ambiente.

## Comparação visual

A implementação preserva a hierarquia da referência: cabeçalho compacto, hero cinematográfico de Elden Ring, CTA e índice em azul, faixa top 5, colunas de última semana/de sempre e cartão de recorde. O conteúdo real do dashboard pode alterar a ordem dos jogos sem alterar a anatomia visual.

Diferenças deliberadas:

- o primeiro colocado atual é Counter-Strike 2, enquanto Elden Ring permanece como destaque editorial do hero;
- os textos do hero usam a descrição retornada pela API;
- a página final é ligeiramente mais alta que a referência para preservar legibilidade e alvos de clique;
- o cabeçalho agora é transparente e fica sobre o hero, mantendo a imagem do jogo contínua atrás da navegação.

## Interações verificadas no navegador integrado

- dashboard carregando `/api/dashboard`;
- modal “Como calculamos” abre, recebe foco, fecha com `Esc` e restaura o foco;
- Catálogo consulta `/api/games` e retorna 10 cartões;
- busca por “Cyberpunk” reduz o catálogo a um resultado;
- detalhes abrem em `/jogos/cyberpunk-2077`;
- link de loja aponta para a página oficial da Steam;
- voltar do navegador retorna ao catálogo via `popstate`;
- layout móvel sem overflow horizontal;
- console: zero erros e zero avisos.

## Histórico de ajustes

1. Normalizados os formatos de lojas e recordes entre API e frontend.
2. Catálogo e detalhes passaram a consumir os endpoints reais.
3. Adicionados `popstate`, fechamento por `Esc` e restauração de foco.
4. Removidos gradientes e elementos desenhados em CSS; ícones usam Phosphor.
5. Hero fixado em Elden Ring para manter fidelidade à referência, sem alterar o ranking atual.
6. Ajustados idioma, título e metadados do documento HTML.
7. Cabeçalho da home passou a ser transparente e sobreposto ao hero, com padding responsivo para preservar o conteúdo.
8. Removida a seta do CTA “Ver detalhes”, conforme anotação visual.

final result: passed
