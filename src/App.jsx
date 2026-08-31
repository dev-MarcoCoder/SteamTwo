import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ArrowSquareOut, BookmarkSimple, CaretDown, ChartLineUp, Check, Circle, FunnelSimple, GameController, Info, MagnifyingGlass, Star, TrendUp, UsersThree, X } from "@phosphor-icons/react";

const games = {
  elden: { id: "elden-ring-shadow-of-the-erdtree", slug: "elden-ring-shadow-of-the-erdtree", title: "ELDEN RING Shadow of the Erdtree", shortTitle: "Elden Ring: Shadow of the Erdtree", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_hero.jpg", score: 94.7, genres: ["RPG", "Ação", "Mundo aberto"], stores: ["steam"], trend: 5, summary: "O DLC que redefiniu as Terras Intermédias voltou ao topo. Picos de jogadores, avaliações excelentes e o hype da comunidade impulsionam Elden Ring como o destaque absoluto da semana.", metric: "18,4 mil jogadores simultâneos" },
  wukong: { id: "black-myth-wukong", slug: "black-myth-wukong", title: "Black Myth: Wukong", shortTitle: "Black Myth: Wukong", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/2358720/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/2358720/library_hero.jpg", score: 90.1, genres: ["RPG", "Ação"], stores: ["steam", "epic"], trend: 2, summary: "Uma jornada mitológica de ação com combates intensos e cenários memoráveis.", metric: "12,1 mil jogadores simultâneos" },
  baldur: { id: "baldurs-gate-3", slug: "baldurs-gate-3", title: "Baldur's Gate 3", shortTitle: "Baldur's Gate 3", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/library_hero.jpg", score: 88.3, genres: ["RPG", "Estratégia"], stores: ["steam"], trend: -1, summary: "Escolhas profundas, personagens inesquecíveis e um mundo que reage a cada decisão.", metric: "9,8 mil jogadores simultâneos" },
  hades: { id: "hades-ii", slug: "hades-ii", title: "Hades II", shortTitle: "Hades II", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1145350/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1145350/library_hero.jpg", score: 86.2, genres: ["Ação", "Roguelike"], stores: ["steam", "epic"], trend: 3, summary: "A nova descida ao submundo da Supergiant Games mantém a fórmula em alta.", metric: "8,2 mil jogadores simultâneos" },
  cyberpunk: { id: "cyberpunk-2077", slug: "cyberpunk-2077", title: "Cyberpunk 2077", shortTitle: "Cyberpunk 2077", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_hero.jpg", score: 83.6, genres: ["RPG", "Ação"], stores: ["steam", "epic"], trend: -2, summary: "Night City continua entre os mundos abertos mais visitados da atualidade.", metric: "7,5 mil jogadores simultâneos" },
  witcher: { id: "the-witcher-3-wild-hunt", slug: "the-witcher-3-wild-hunt", title: "The Witcher 3: Wild Hunt", shortTitle: "The Witcher 3: Wild Hunt", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/292030/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/292030/library_hero.jpg", score: 97, genres: ["RPG", "Mundo aberto"], stores: ["steam"], trend: 0, summary: "Uma aventura de fantasia que segue como referência para o gênero.", metric: "Popularidade histórica" },
  rdr2: { id: "red-dead-redemption-2", slug: "red-dead-redemption-2", title: "Red Dead Redemption 2", shortTitle: "Red Dead Redemption 2", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_hero.jpg", score: 96.2, genres: ["Ação", "Mundo aberto"], stores: ["steam"], trend: 0, summary: "O Velho Oeste em uma história densa, lenta e inesquecível.", metric: "Popularidade histórica" },
  portal: { id: "portal-2", slug: "portal-2", title: "Portal 2", shortTitle: "Portal 2", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_hero.jpg", score: 95.8, genres: ["Puzzle", "Aventura"], stores: ["steam"], trend: 0, summary: "Puzzles criativos e humor afiado em um dos clássicos mais queridos da Steam.", metric: "Popularidade histórica" },
  god: { id: "god-of-war", slug: "god-of-war", title: "God of War", shortTitle: "God of War", coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1593500/library_600x900_2x.jpg", heroUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1593500/library_hero.jpg", score: 94.9, genres: ["Ação", "Aventura"], stores: ["steam"], trend: 0, summary: "Uma jornada nórdica sobre pais e filhos, com combate cinematográfico.", metric: "Popularidade histórica" }
};
const fallback = { hero: games.elden, topFive: [games.elden, games.wukong, games.baldur, games.hades, games.cyberpunk], week: [games.elden, games.wukong, games.baldur, games.hades, games.cyberpunk], allTime: [games.witcher, games.rdr2, games.portal, games.elden, games.god], records: [{ title: "The Witcher 3: Wild Hunt", value: "97,6", label: "Maior índice SteamTwo", date: "24 de dez. de 2022", coverUrl: games.witcher.coverUrl }], updatedAt: "2026-08-24T18:00:00.000Z", sourceStatus: { steam: "available", epic: "available", igdb: "available" } };
const formatScore = (score) => typeof score === "number" ? score.toFixed(1).replace(".", ",") : score || "—";
const formatDate = (date) => { try { return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date)); } catch { return "24 de agosto de 2026"; } };
const storeLabel = (store) => store === "steam" ? "Steam" : store === "epic" ? "Epic Games" : "Todos";
const fallbackForSlug = (slug) => Object.values(games).find((game) => game.slug === slug);
const storeKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase().replace(/\s+/g, "-");
  return storeKey(value.store || value.key || value.name || value.slug || value.label);
};
const normalizeGame = (raw = {}, base = {}) => {
  const stores = Array.isArray(raw.stores) ? raw.stores : (base.stores || []);
  const storeLinks = { ...(base.storeLinks || {}) };
  stores.forEach((entry) => {
    if (entry && typeof entry === "object") {
      const key = storeKey(entry);
      if (key && entry.url) storeLinks[key] = entry.url;
    }
  });
  const title = raw.title || raw.name || base.title || "Jogo sem título";
  return {
    ...base,
    ...raw,
    id: raw.id || base.id || raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    slug: raw.slug || base.slug || raw.id,
    title,
    shortTitle: raw.shortTitle || raw.short_title || title,
    summary: raw.summary || raw.description || base.summary || "",
    coverUrl: raw.coverUrl || raw.cover_url || raw.cover?.url || base.coverUrl || null,
    heroUrl: raw.heroUrl || raw.hero_url || raw.hero?.url || base.heroUrl || raw.coverUrl || null,
    genres: Array.isArray(raw.genres) ? raw.genres.map((genre) => typeof genre === "string" ? genre : genre.name).filter(Boolean) : (base.genres || []),
    stores: stores.map(storeKey).filter(Boolean).length ? stores.map(storeKey).filter(Boolean) : (base.stores || []),
    storeLinks,
  };
};
const normalizeRecord = (raw = {}) => {
  const recordGame = typeof raw.game === "object" ? normalizeGame(raw.game, fallbackForSlug(raw.game?.slug) || {}) : (fallbackForSlug(raw.slug) || games.witcher);
  return { ...raw, title: recordGame.shortTitle, label: raw.label || raw.type || "Recorde monitorado", value: raw.value ?? raw.score ?? "—", date: raw.achievedAt ? formatDate(raw.achievedAt) : (raw.date || "—"), coverUrl: raw.coverUrl || recordGame.coverUrl, game: recordGame };
};
const normalizeDashboard = (payload = {}, current = fallback) => ({
  ...current,
  ...payload,
  hero: payload.hero ? normalizeGame(payload.hero, current.hero) : current.hero,
  topFive: Array.isArray(payload.topFive) && payload.topFive.length ? payload.topFive.map((item) => normalizeGame(item, fallbackForSlug(item.slug) || {})) : current.topFive,
  week: Array.isArray(payload.week) && payload.week.length ? payload.week.map((item) => normalizeGame(item, fallbackForSlug(item.slug) || {})) : current.week,
  allTime: Array.isArray(payload.allTime) && payload.allTime.length ? payload.allTime.map((item) => normalizeGame(item, fallbackForSlug(item.slug) || {})) : current.allTime,
  records: Array.isArray(payload.records) && payload.records.length ? payload.records.map(normalizeRecord) : current.records,
});
const storeUrlForGame = (game) => game.storeLinks?.[game.stores?.[0]] || (game.stores?.[0] === "epic" ? `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(game.title)}` : `https://store.steampowered.com/search/?term=${encodeURIComponent(game.title)}`);
function SafeImage({ src, alt, className = "", ...props }) { const [url, setUrl] = useState(src); return <img className={className} src={url} alt={alt} loading="lazy" onError={() => setUrl("https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80")} {...props} />; }
function Trend({ value, compact = false }) { if (!value) return <span className="trend neutral">—</span>; const positive = value > 0; return <span className={`trend ${positive ? "positive" : "negative"}`}>{positive ? <ArrowUpRight size={compact ? 15 : 16} weight="bold" /> : <ArrowDownRight size={compact ? 15 : 16} weight="bold" />} {Math.abs(value)}</span>; }
function Header({ view, onNavigate, search, setSearch }) { return <header className={`site-header ${view === "home" ? "site-header-overlay" : ""}`}><button className="brand" onClick={() => onNavigate("home")} aria-label="SteamTwo, início"><span>Steam</span><b>Two</b></button><nav aria-label="Navegação principal"><button className={view === "home" ? "active" : ""} onClick={() => onNavigate("home")}>Início</button><button className={view === "catalog" ? "active" : ""} onClick={() => onNavigate("catalog")}>Catálogo</button><button className={view === "rankings" ? "active" : ""} onClick={() => onNavigate("rankings")}>Rankings</button></nav><label className="search-box"><MagnifyingGlass size={20} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar jogos" aria-label="Buscar jogos" /></label></header>; }
function Score({ value, large = false }) { return <span className={large ? "score score-large" : "score"}>{formatScore(value)}</span>; }
function Hero({ game, onDetails, onMethodology }) { return <section className="hero" style={{ "--hero-image": `url(${game.heroUrl})` }}><div className="hero-content"><div className="spotlight"><span>DATA SPOTLIGHT</span><Circle size={7} weight="fill" color="var(--blue)" /> <time>Segunda-feira, 24 de agosto de 2026</time></div><div className="eyebrow">O JOGO DO MOMENTO</div><h1>ELDEN RING <small>SHADOW <em>OF THE</em> ERDTREE</small></h1><p>{game.summary}</p><div className="hero-actions"><button className="primary-button" onClick={onDetails}>Ver detalhes</button><button className="list-button"><BookmarkSimple size={19} /> Adicionar à lista</button></div></div><aside className="hero-score"><div className="score-heading"><h2>Índice SteamTwo</h2><button onClick={onMethodology}>Como calculamos <Info size={15} /></button></div><div><Score value={game.score} large /> <span className="out-of">/100</span></div><p>Ranking combinado de Steam e Epic Games que considera tração recente, qualidade e engajamento da comunidade.</p><div className="score-lines"><span><TrendUp size={19} /> Tração (últ. 7 dias) <b>96</b></span><span><Star size={19} /> Qualidade (avaliações) <b>93</b></span><span><UsersThree size={19} /> Engajamento <b>95</b></span></div><small>Dados de 18–24 de ago. de 2026</small></aside></section>; }
function TopStrip({ items, onDetails }) { return <section className="top-strip" aria-label="Top cinco da semana">{items.map((game, index) => <button className="top-item" key={game.id} onClick={() => onDetails(game)}><strong>{index + 1}</strong><SafeImage src={game.coverUrl} alt="" /><span><b>{game.shortTitle}</b><Score value={game.score} /><Trend value={game.trend} compact /></span></button>)}</section>; }
function StoreFilters({ value, onChange }) { return <div className="store-filter" role="tablist" aria-label="Filtrar por loja">{[["all", "Todos"], ["steam", "Steam"], ["epic", "Epic Games"]].map(([key, label]) => <button key={key} className={value === key ? "selected" : ""} onClick={() => onChange(key)} role="tab" aria-selected={value === key}>{label}</button>)}</div>; }
function WeekList({ items, onDetails }) { return <div className="week-list">{items.map((game, index) => <button className="week-row" key={game.id} onClick={() => onDetails(game)}><strong>{index + 1}</strong><SafeImage src={game.coverUrl} alt="" /><span className="week-title">{game.shortTitle}</span><Score value={game.score} /><Trend value={game.trend} /></button>)}</div>; }
function AllTime({ items, onDetails }) { return <div className="poster-grid">{items.slice(0, 5).map((game) => <button className="poster" key={game.id} onClick={() => onDetails(game)}><SafeImage src={game.coverUrl} alt={`Capa de ${game.shortTitle}`} /><span className="poster-score">{formatScore(game.score)}</span></button>)}</div>; }
function RecordCard({ record, onDetails }) { return <button className="record-card" onClick={() => onDetails(record.game || games.witcher)}><div className="section-kicker">RECORDE MONITORADO</div><p>{record.label}</p><Score value={record.value} /><SafeImage src={record.coverUrl} alt="" /><b>{record.title}</b><small>Alcançado em<br />{record.date}</small></button>; }
function Home({ data, onDetails, onMethodology }) { const [store, setStore] = useState("all"); const week = useMemo(() => store === "all" ? data.week : data.week.filter((game) => game.stores.includes(store)), [data.week, store]); return <><Hero game={data.hero} onDetails={() => onDetails(data.hero)} onMethodology={onMethodology} /><TopStrip items={data.topFive} onDetails={onDetails} /><section className="dashboard-grid"><div className="week-panel"><div className="section-head"><div><h2>ÚLTIMA SEMANA</h2><p>18–24 de ago. de 2026</p></div><StoreFilters value={store} onChange={setStore} /></div><WeekList items={week} onDetails={onDetails} /><button className="more-link" onClick={() => onDetails(null)}>Ver top 100 da semana <ArrowRight size={19} /></button></div><div className="alltime-panel"><div className="section-head"><div><h2>DE SEMPRE</h2><p>Os jogos com maior índice SteamTwo de todos os tempos.</p></div></div><AllTime items={data.allTime} onDetails={onDetails} /><button className="more-link" onClick={() => onDetails(null)}>Ver todos os tempos <ArrowRight size={19} /></button></div><RecordCard record={data.records[0]} onDetails={onDetails} /></section></>; }
function GameCard({ game, onDetails }) { return <button className="game-card" onClick={() => onDetails(game)}><SafeImage src={game.coverUrl} alt={`Capa de ${game.shortTitle}`} /><div><span className="game-card-score"><Score value={game.score} /></span><h3>{game.shortTitle}</h3><p>{game.genres.join(" · ")}</p><span className="card-stores">{game.stores.map(storeLabel).join(" · ")}</span></div></button>; }
function Catalog({ data, query, onDetails }) {
  const [store, setStore] = useState("all");
  const [genre, setGenre] = useState("all");
  const [apiGames, setApiGames] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const fallbackGames = useMemo(() => [...data.topFive, ...data.allTime].filter((game, index, array) => array.findIndex((item) => item.id === game.id) === index), [data]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (store !== "all") params.set("store", store);
    if (genre !== "all") params.set("genre", genre);
    setLoading(true);
    setApiError(false);
    fetch(`/api/games?${params.toString()}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Catálogo indisponível"))).then((payload) => {
      const items = Array.isArray(payload) ? payload : (payload.games || payload.items || payload.data || []);
      setApiGames(items.map((item) => normalizeGame(item, fallbackForSlug(item.slug) || {})));
    }).catch((error) => { if (error.name !== "AbortError") { setApiError(true); setApiGames(null); } }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, store, genre]);
  const source = apiGames ?? fallbackGames;
  const genres = [...new Set(source.flatMap((game) => game.genres || []))];
  const filtered = source.filter((game) => (!query || game.title.toLowerCase().includes(query.toLowerCase())) && (store === "all" || game.stores.includes(store)) && (genre === "all" || game.genres.includes(genre)));
  return <section className="catalog-page"><div className="page-intro"><div><span className="eyebrow">BIBLIOTECA STEAMTWO</span><h1>Catálogo de jogos</h1><p>Explore jogos acompanhados pelas fontes Steam, Epic Games e IGDB.</p></div><GameController size={58} weight="thin" /></div><div className="catalog-toolbar"><div className="filter-control"><FunnelSimple size={18} /><StoreFilters value={store} onChange={setStore} /></div><label className="select-control">Gênero <select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">Todos os gêneros</option>{genres.map((item) => <option value={item} key={item}>{item}</option>)}</select><CaretDown size={16} /></label></div>{loading ? <div className="empty-state"><GameController size={34} /><h2>Carregando catálogo</h2><p>Buscando jogos nas fontes do SteamTwo…</p></div> : filtered.length ? <div className="catalog-grid">{filtered.map((game) => <GameCard game={game} onDetails={onDetails} key={game.id} />)}</div> : <div className="empty-state"><GameController size={34} /><h2>{apiError ? "Catálogo temporariamente indisponível" : "Nenhum jogo encontrado"}</h2><p>{apiError ? "Exibindo os últimos jogos válidos." : "Tente outra busca ou remova algum filtro."}</p></div>}</section>;
}
function Rankings({ data, onDetails }) { return <section className="rankings-page"><div className="page-intro"><div><span className="eyebrow">RANKINGS</span><h1>Quem está no topo?</h1><p>Veja como os jogos evoluíram nos rankings monitorados pelo SteamTwo.</p></div><ChartLineUp size={58} weight="thin" /></div><div className="ranking-table"><div className="table-head"><span>#</span><span>Jogo</span><span>Índice SteamTwo</span><span>Variação</span></div>{data.topFive.map((game, index) => <button className="table-row" key={game.id} onClick={() => onDetails(game)}><strong>{index + 1}</strong><span><SafeImage src={game.coverUrl} alt="" /><b>{game.shortTitle}</b></span><Score value={game.score} /><Trend value={game.trend} /></button>)}</div></section>; }
function Detail({ game, onBack, onMethodology }) { return <section className="detail-page"><button className="back-link" onClick={onBack}><ArrowRight size={17} /> Voltar</button><div className="detail-hero" style={{ "--detail-image": `url(${game.heroUrl})` }}><div><span className="eyebrow">DETALHE DO JOGO</span><h1>{game.shortTitle}</h1><div className="detail-tags">{game.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><p>{game.summary}</p><div className="detail-actions"><a className="primary-button" href={storeUrlForGame(game)} target="_blank" rel="noreferrer">Abrir na loja <ArrowSquareOut size={17} /></a><button className="list-button"><BookmarkSimple size={19} /> Adicionar à lista</button></div></div><div className="detail-score"><span>ÍNDICE STEAMTWO</span><Score value={game.score} large /><small>/ 100</small><button onClick={onMethodology}>Como calculamos <Info size={14} /></button></div></div><div className="detail-columns"><article><h2>Sobre este jogo</h2><p>{game.summary} O índice combina tração, qualidade e engajamento para oferecer uma leitura comparável entre os títulos.</p></article><aside><h2>Fontes</h2><div className="source-pills">{game.stores.map((store) => <span key={store}><Check size={14} /> {storeLabel(store)}</span>)}<span><Check size={14} /> IGDB</span></div><small>Última atualização: 24 de ago. de 2026</small></aside></div></section>; }
function Methodology({ onClose }) {
  const closeRef = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    closeRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previousFocus.current?.focus?.(); };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="methodology-modal" role="dialog" aria-modal="true" aria-labelledby="method-title"><button ref={closeRef} className="modal-close" aria-label="Fechar" onClick={onClose}><X size={20} /></button><span className="eyebrow">TRANSPARÊNCIA</span><h2 id="method-title">Como calculamos</h2><p>O Índice SteamTwo combina sinais públicos de popularidade para destacar jogos em alta sem fingir que a plataforma recebe jogadores.</p><div className="method-grid"><div><strong>01</strong><h3>Tração recente</h3><p>Posição Steam e Epic normalizada por ranking. A semana é a média de sete snapshots válidos.</p></div><div><strong>02</strong><h3>Qualidade</h3><p>Avaliações e popularidade histórica são trazidas da IGDB, com atualização diária.</p></div><div><strong>03</strong><h3>Limitações</h3><p>A Epic publica posição, não contagem de jogadores. Quando uma fonte falha, mantemos o último snapshot válido.</p></div></div><small className="method-foot">Fontes: Steam, Epic Games e IGDB · dados de 18–24 de agosto de 2026</small></section></div>;
}
export function App() {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("home");
  const [selected, setSelected] = useState(null);
  const [methodology, setMethodology] = useState(false);

  const loadDetail = (slug, base) => {
    setLoading(true);
    fetch(`/api/games/${encodeURIComponent(slug)}`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Detalhe indisponível"))).then((payload) => {
      const raw = payload.game || payload.data || payload;
      setSelected(normalizeGame(raw, base));
      setStale(false);
    }).catch(() => setStale(true)).finally(() => setLoading(false));
  };

  useEffect(() => {
    const applyLocation = () => {
      const path = window.location.pathname;
      if (path.startsWith("/catalogo")) { setSelected(null); setView("catalog"); }
      else if (path.startsWith("/rankings")) { setSelected(null); setView("rankings"); }
      else if (path.startsWith("/jogos/")) {
        const slug = decodeURIComponent(path.slice("/jogos/".length));
        const base = fallbackForSlug(slug) || normalizeGame({ slug, title: slug.replace(/-/g, " ") });
        setSelected(base);
        setView("home");
        loadDetail(slug, base);
      } else { setSelected(null); setView("home"); }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("API indisponível"))).then((payload) => {
      setData((current) => normalizeDashboard(payload, current));
      setStale(false);
    }).catch((error) => { if (error.name !== "AbortError") setStale(true); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const navigate = (next) => {
    setSelected(null);
    setView(next);
    window.history.pushState({}, "", next === "home" ? "/" : `/${next === "catalog" ? "catalogo" : "rankings"}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const details = (game) => {
    if (!game) return navigate("rankings");
    const normalized = normalizeGame(game, fallbackForSlug(game.slug) || {});
    setSelected(normalized);
    window.history.pushState({}, "", `/jogos/${normalized.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadDetail(normalized.slug, normalized);
  };
  return <div className="app-shell"><Header view={selected ? "" : view} onNavigate={navigate} search={search} setSearch={setSearch} />{loading && <div className="loading-bar" aria-label="Carregando dados" />}<main>{selected ? <Detail game={selected} onBack={() => navigate("home")} onMethodology={() => setMethodology(true)} /> : view === "catalog" ? <Catalog data={data} query={search} onDetails={details} /> : view === "rankings" ? <Rankings data={data} onDetails={details} /> : <Home data={data} onDetails={details} onMethodology={() => setMethodology(true)} />}</main><footer><span>SteamTwo</span><span>Dados públicos, rankings transparentes.</span><button onClick={() => setMethodology(true)}>Metodologia</button>{stale && <small>Últimos dados válidos · {formatDate(data.updatedAt)}</small>}</footer>{methodology && <Methodology onClose={() => setMethodology(false)} />}</div>;
}
