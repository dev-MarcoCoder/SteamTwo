# SteamTwo

Catálogo de jogos com dashboard de popularidade da Steam e Epic Games, interface em React/HTML/CSS/JS, API Node.js/Express e persistência PostgreSQL.

## Funcionalidades

- dashboard com mais jogados agora, média da última semana, popularidade histórica e recorde monitorado;
- catálogo pesquisável e filtrável por loja e gênero;
- ranking combinado transparente;
- página de detalhes com link para a loja oficial;
- coleta da Steam, Epic Games e IGDB com snapshots imutáveis;
- fallback visual com dados realistas quando o PostgreSQL ainda não foi configurado.

## Como os rankings funcionam

Cada posição de uma fonte é normalizada por `100 × (N - posição + 1) / N`. O índice combinado é a média das fontes disponíveis. Ausência em uma coleta válida vale zero; se a fonte inteira estiver indisponível, ela é excluída do cálculo.

- **Agora:** último snapshot válido da Steam e Epic.
- **Última semana:** média de sete snapshots diários válidos.
- **De sempre:** proxy de popularidade histórica da IGDB; não representa horas jogadas.
- **Recorde monitorado:** maior índice registrado desde o início da coleta.

A Steam disponibiliza posição e jogadores simultâneos. A coleção oficial da Epic é tentada primeiro; quando bloqueia coleta automatizada com `403/429`, o job usa o ranking público do egdata e identifica explicitamente o provedor como `egdata-fallback`. A Epic não fornece contagem pública de jogadores nesse ranking.

## Execução local

Requisitos: Node.js 20+ e PostgreSQL 17 (ou Docker).

```bash
npm install
docker compose up -d
copy .env.example .env
npm run db:migrate
npm run dev:api
npm run dev
```

Frontend: `http://127.0.0.1:5173/`  
API: `http://127.0.0.1:3001/api/health`

Para enriquecer o catálogo com a IGDB, preencha `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` no `.env` e execute:

```bash
npm run sync:catalog
npm run sync:rankings
npm run sync:popularity
```

## Verificação

```bash
npm test
npm run build
npm run test:sites
```

O banco pode ser revertido uma migração por vez com `npm run db:rollback`.

