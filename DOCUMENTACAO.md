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
- Endpoint novo: `GET /api/promotions?filter=all|on-sale|half-price|free&store=all|steam|epic`.

### 3.3 Tema claro/escuro

- Botão de alternância no cabeçalho, com persistência em `localStorage` e respeito à preferência do sistema (`prefers-color-scheme`) no primeiro acesso.
- Script inline no `index.html` que aplica o tema salvo **antes** do React montar, evitando o "flash" de tema errado ao carregar a página.
- Paleta clara nova usando as mesmas variáveis CSS (`--bg`, `--panel`, `--text` etc.), com ajustes específicos em componentes que tinham cores fixas (cards, tabelas, modal, cabeçalho).
- Exceção deliberada: as áreas com foto de fundo (hero da home e do detalhe do jogo, capas na seção de promoções) permanecem sempre no estilo escuro, porque o texto branco por cima da imagem perderia legibilidade num scrim claro — é um padrão comum em sites com tema claro/escuro.

### 3.4 O que foi decidido não implementar

**Mais lojas no ranking (PlayStation/Xbox)** foi descartado, a pedido explícito do usuário durante o planejamento. Motivo: Sony e Microsoft não publicam nenhuma API pública de "mais jogados"/popularidade equivalente à da Steam. Inventar ou estimar esses números contrariaria o próprio princípio de transparência que o projeto já declara no README (a metodologia existente é explícita sobre excluir fontes indisponíveis em vez de simular dados). Nada foi alterado na lista de lojas suportadas (`store_name`, `storeFilters`) por esse motivo.

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
| `ranking_snapshots`, `ranking_entries` | snapshots diários e **imutáveis** (protegidos por trigger no banco) de posição por loja — é daqui que o histórico de popularidade é calculado |
| `game_rankings` | rankings combinados por período (now/week/all-time) |
| `sync_runs` | auditoria de cada execução dos jobs de coleta |

**Jobs de coleta** (`server/jobs/*.js`, executados via `node server/jobs/cli.js <comando>`): cada um usa `withAdvisoryLock` (lock do PostgreSQL) para nunca rodar duas instâncias em paralelo, registra início/fim em `sync_runs`, e grava seus resultados através do `job-repository.js`. O job de preços (`prices.js`) é o único que consulta APIs de "loja por loja" (uma chamada HTTP por jogo na Steam), então roda com concorrência limitada para não sobrecarregar a API pública.

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

Sem passos 2–4, o projeto ainda roda em **modo demo** (dados mockados) — útil para desenvolver a UI rapidamente sem banco.

### Popular o catálogo com dados reais

Requer credenciais da IGDB/Twitch (`TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` no `.env`):

```bash
npm run sync:catalog      # catálogo de jogos (IGDB)
npm run sync:rankings     # posições Steam + Epic (base do índice e do histórico)
npm run sync:popularity   # popularidade histórica (IGDB)
npm run sync:prices       # preços e promoções (Steam + Epic)
```

`npm run sync:rankings` precisa ser executado periodicamente (ex.: diariamente, via cron) para que o gráfico de histórico tenha dados suficientes ao longo do tempo.

### Testes e build

```bash
npm test          # roda em modo demo, sem precisar de banco
npm run build      # build de produção do frontend
npm run test:sites # verificação específica do empacotamento para hospedagem
```

O banco pode ser revertido uma migration por vez com `npm run db:rollback`.
