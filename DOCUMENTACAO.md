# Documentação do SteamTwo

Este documento registra o estado do projeto antes das melhorias recentes, o que foi implementado agora, como o back-end se integra com o banco de dados, e como executar o projeto do zero.

## 1. Visão geral

O SteamTwo é um catálogo de jogos com dashboard de popularidade (Steam, Epic Games e IGDB), composto por:

- **Frontend**: React 19 + Vite, um único componente `src/App.jsx` com navegação por `pushState` (sem router externo).
- **Backend**: Node.js + Express, expondo uma API REST em `/api`.
- **Banco de dados**: PostgreSQL, com migrations versionadas (`node-pg-migrate`).
- **Jobs de coleta**: scripts que consultam Steam, Epic e IGDB e gravam snapshots no banco.

## 2. O que já existia

- Dashboard inicial com jogo em destaque, top 5 da semana, "de sempre" (popularidade histórica via IGDB) e recorde monitorado.
- Catálogo pesquisável e filtrável por loja (Steam/Epic) e gênero.
- Página de rankings e página de detalhe de cada jogo.
- Índice SteamTwo: `100 × (N - posição + 1) / N`, combinando Steam e Epic (`server/domain/ranking/index.js`).
- Coleta de dados via jobs (`server/jobs/*.js`): catálogo (IGDB), rankings (Steam + Epic) e popularidade histórica (IGDB).
- Modo "demo": quando não há `DATABASE_URL` configurada, a API cai para dados mockados (`server/mock/games.js`), o que também é o que os testes automatizados (`npm test`) usam — não dependem de banco.
- Modal de metodologia explicando o cálculo do índice.
- Tema único, escuro, sem alternância.

## 3. O que foi implementado agora

### 3.1 Gráfico histórico de popularidade

Nova seção, visualmente separada, na página de detalhe de cada jogo, com um gráfico de linha (SVG desenhado manualmente, sem nenhuma biblioteca de gráficos nova).

- O histórico é calculado a partir dos snapshots diários já coletados de Steam e Epic (`ranking_snapshots` / `ranking_entries`), reaproveitando a mesma fórmula de normalização usada no resto do projeto.
- Endpoint novo: `GET /api/games/:slug/history?days=90`.
- Se não houver snapshots suficientes ainda (jogo novo ou coleta recém-iniciada), a UI mostra "Histórico insuficiente para este jogo ainda." em vez de um gráfico vazio ou quebrado.

### 3.2 Promoções do dia

Nova seção na página inicial, logo acima do restante do dashboard, com filtro por **Em promoção**, **Metade do preço ou mais** e **Grátis**, usando dados reais de preço da Steam e da Epic (as únicas lojas já integradas ao projeto).

- Nova tabela `store_prices` (preço atual por loja, não é histórico).
- Steam: endpoint público `store.steampowered.com/api/appdetails` (preço, desconto, gratuidade).
- Epic: endpoint público (não documentado oficialmente, mas já usado por várias ferramentas da comunidade) `freeGamesPromotions`, que cobre o catálogo promovido/gratuito da Epic — por isso a cobertura da Epic é parcial, e a API sinaliza isso explicitamente (`sourceStatus.epic = "partial"`).
- Novo job `server/jobs/prices.js` (`npm run sync:prices`).
- Endpoint novo: `GET /api/promotions?filter=all|on-sale|half-price|free&store=all|steam|epic&genre=<nome-do-genero>`.
- Filtro adicional por **categoria** (Ação, RPG, Aventura etc.): reaproveita os mesmos gêneros já vinculados ao jogo no catálogo (tabela `genres`/`game_genres`, populada pela IGDB) — nenhuma categoria nova foi inventada, só filtramos a lista de promoções pelo gênero já cadastrado. O dropdown de categorias na UI (`src/components/Promotions.jsx`) é populado dinamicamente a partir dos gêneros presentes nas promoções atuais, do mesmo jeito que o filtro de gênero do Catálogo já funcionava.

### 3.3 Tema claro/escuro

- Botão de alternância no cabeçalho, com persistência em `localStorage` e respeito à preferência do sistema (`prefers-color-scheme`) no primeiro acesso.
- Script inline no `index.html` que aplica o tema salvo **antes** do React montar, evitando o "flash" de tema errado ao carregar a página.
- Paleta clara nova usando as mesmas variáveis CSS (`--bg`, `--panel`, `--text` etc.), com ajustes específicos em componentes que tinham cores fixas (cards, tabelas, modal, cabeçalho).
- Exceção deliberada: as áreas com foto de fundo (hero da home e do detalhe do jogo, capas na seção de promoções) permanecem sempre no estilo escuro, porque o texto branco por cima da imagem perderia legibilidade num scrim claro — é um padrão comum em sites com tema claro/escuro.

### 3.4 O que foi decidido não implementar

**Mais lojas no ranking (PlayStation/Xbox)** foi descartado, a pedido explícito do usuário durante o planejamento. Motivo: Sony e Microsoft não publicam nenhuma API pública de "mais jogados"/popularidade equivalente à da Steam. Inventar ou estimar esses números contrariaria o próprio princípio de transparência que o projeto já declara no README (a metodologia existente é explícita sobre excluir fontes indisponíveis em vez de simular dados). Nada foi alterado na lista de lojas suportadas (`store_name`, `storeFilters`) por esse motivo.

### 3.5 Correções encontradas rodando o projeto de verdade contra um Postgres real

As três funcionalidades acima foram implementadas e testadas primeiro só com testes automatizados (que rodam contra um banco falso). Ao subir o projeto contra um PostgreSQL real pela primeira vez, apareceram três problemas que **já existiam no projeto antes dessas melhorias** — não foram causados por elas, só nunca tinham sido exercitados de verdade:

1. **`jsonb_build_object` sem tipo de parâmetro definido** em `server/db/job-repository.js` (`finishSyncRun`) — o Postgres não consegue inferir o tipo de um parâmetro usado só dentro de uma função variádica como `jsonb_build_object`. Corrigido com um cast explícito (`$4::int`).
2. **Reconexão indevida de um client já conectado**, também em `job-repository.js` (função auxiliar `transaction`) — o código usava `typeof clientOrPool.connect === "function"` para decidir se devia abrir uma conexão nova, mas um client já retirado do pool (usado durante o advisory lock) também herda esse método, e chamá-lo de novo derruba o processo. Corrigido trocando o critério para `typeof clientOrPool.release === "function"`, que só existe em clients já conectados.
3. **`game_rankings` nunca era calculada** — nenhum job existente lia os snapshots brutos (`ranking_snapshots`/`ranking_entries`) e gravava o Índice SteamTwo combinado. Isso fazia o catálogo e a Home sempre mostrarem nota "0,0", mesmo com posição e jogadores reais no banco. Implementei `recomputeCurrentRankings()` (`server/db/job-repository.js`), que recalcula o índice do período "agora" a partir do último snapshot de cada loja — reaproveitando a mesma matemática de `server/domain/ranking/index.js` — e é chamado automaticamente ao final de `npm run sync:rankings`.

Todos os testes automatizados (38 no total) continuam passando depois dessas correções.

### 3.6 Preço e botão de compra no detalhe do jogo

A página de detalhe de cada jogo (`Detail`, em `src/App.jsx`) já existia e já era acessível clicando em qualquer card (topo da semana, catálogo, rankings, promoções). Duas coisas estavam faltando nela:

- **Preço**: quando o jogo tem preço rastreado (mesma tabela `store_prices` da seção 3.2), a tela mostra o preço original riscado e o preço com desconto (ou "Grátis"), usando a mesma lógica de "melhor preço" já usada no card de promoções. Sem dado de preço, a seção simplesmente não aparece — nada é inventado.
- **Botão "Comprar"**: o botão que antes dizia "Abrir na loja" foi renomeado para "Comprar" e continua abrindo, em nova aba, a página real daquele jogo específico na Steam ou na Epic (`storeUrlForGame`, usando a URL de `store_listings`; só cai para uma busca genérica se o jogo não tiver o link direto cadastrado).

Nenhuma rota nova foi necessária: `GET /api/games/:slug` já devolvia `prices`, só não estava sendo lido no front.

## 4. Integração back-end ↔ banco de dados

O back-end segue uma arquitetura em camadas, sempre na mesma direção: **rota → serviço → repositório → banco**.

```
server/routes/index.js        valida entrada (zod) e delega ao serviço
server/services/catalog-service.js   regras de negócio (filtros, ordenação, paginação)
server/db/catalog-read-repository.js  leituras (SQL) usadas pela API
server/db/job-repository.js   escritas (SQL) usadas pelos jobs de coleta
server/db/pool.js             pool de conexões PostgreSQL (pg)
```

**Modo demo vs. modo real**: `server/services/catalog-service.js` recebe um `repository` opcional. Se `DATABASE_URL` não estiver configurada (`server/index.js`), nenhum repositório é criado e o serviço usa os dados de `server/mock/games.js` como fonte. É assim que o projeto roda sem banco em desenvolvimento local rápido e nos testes automatizados.

**Schema principal** (`migrations/`):

| Tabela | Papel |
|---|---|
| `games`, `genres`, `game_genres` | catálogo de jogos e seus gêneros |
| `store_listings` | vínculo de cada jogo com sua página na Steam/Epic |
| `store_prices` *(novo)* | preço/desconto atual por loja — estado corrente, não histórico |
| `ranking_snapshots`, `ranking_entries` | snapshots diários e **imutáveis** (protegidos por trigger no banco) de posição por loja — é daqui que o histórico de popularidade e o índice combinado são calculados |
| `game_rankings` | rankings combinados por período (now/week/all-time) — recalculada a cada `sync:rankings` desde a correção da seção 3.5 |
| `sync_runs` | auditoria de cada execução dos jobs de coleta |

**Jobs de coleta** (`server/jobs/*.js`, executados via `node server/jobs/cli.js <comando>`): cada um usa `withAdvisoryLock` (lock do PostgreSQL) para nunca rodar duas instâncias em paralelo, registra início/fim em `sync_runs`, e grava seus resultados através do `job-repository.js`. O job de preços (`prices.js`) é o único que consulta APIs de "loja por loja" (uma chamada HTTP por jogo na Steam), então roda com concorrência limitada para não sobrecarregar a API pública. O job de rankings (`rankings.js`), depois de gravar os snapshots de Steam e Epic, agora também recalcula o Índice SteamTwo automaticamente.

**Validado rodando de verdade** (não só em teste automatizado): com um catálogo de 12 jogos reais cadastrado manualmente (IDs verdadeiros de Steam/Epic, sem depender da IGDB), `npm run sync:rankings` trouxe as posições reais da Steam (ex.: Counter-Strike 2 em #1, Apex Legends com mais de 278 mil jogadores simultâneos no momento do teste) e `npm run sync:prices` trouxe preços reais em BRL — tudo refletido no catálogo, na Home e nas promoções.

## 5. Como executar o projeto

### Requisitos

- Node.js 20+
- PostgreSQL 17 (local ou via Docker)

### Passo a passo

```bash
# 1. instalar dependências
npm install

# 2. subir o Postgres (ou aponte DATABASE_URL para um Postgres já existente)
docker compose up -d

# 3. copiar o arquivo de ambiente e ajustar se necessário
copy .env.example .env

# 4. aplicar as migrations
npm run db:migrate

# 5. subir a API e o frontend (em dois terminais)
npm run dev:api
npm run dev
```

- Frontend: `http://127.0.0.1:5173/`
- API: `http://127.0.0.1:3001/api/health`

Sem os passos 2–4, o projeto ainda roda em **modo demo** (dados mockados) — útil para desenvolver a UI rapidamente sem banco.

### Popular o catálogo com dados reais

Existem dois caminhos, dependendo se você tem credenciais da IGDB ou não.

**Com credenciais da IGDB/Twitch** (`TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` no `.env`, geradas em [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)):

```bash
npm run sync:catalog      # catálogo de jogos (IGDB)
npm run sync:rankings     # posições Steam + Epic (base do índice e do histórico)
npm run sync:popularity   # popularidade histórica (IGDB)
npm run sync:prices       # preços e promoções (Steam + Epic)
```

**Sem credenciais da IGDB**: a Steam e a Epic não exigem nenhuma credencial (são endpoints públicos), mas `sync:rankings`/`sync:prices` só conseguem vincular posições/preços a jogos que já existam nas tabelas `games`/`store_listings` — e é a IGDB quem normalmente povoa essas tabelas. Sem ela, é preciso cadastrar manualmente alguns jogos (com IDs reais da Steam/Epic) antes de rodar `sync:rankings`/`sync:prices`, reutilizando o mesmo `repository.upsertCatalogGames(...)` que o job da IGDB usa — foi assim que os dados reais mostrados na seção 4 foram gerados.

`npm run sync:rankings` precisa ser executado periodicamente (ex.: diariamente, via cron) para que o gráfico de histórico tenha dados suficientes ao longo do tempo.

### Testes e build

```bash
npm test          # roda em modo demo, sem precisar de banco
npm run build      # build de produção do frontend
npm run test:sites # verificação específica do empacotamento para hospedagem
```

O banco pode ser revertido uma migration por vez com `npm run db:rollback`.
