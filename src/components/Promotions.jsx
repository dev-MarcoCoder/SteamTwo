import { useEffect, useMemo, useState } from "react";
import { CaretDown, Tag } from "@phosphor-icons/react";
import { formatCurrency } from "../lib/format.js";

const filters = [
  ["all", "Todas"],
  ["on-sale", "Em promoção"],
  ["half-price", "Metade do preço ou mais"],
  ["free", "Grátis"],
];

function SafeImage({ src, alt }) {
  const [url, setUrl] = useState(src);
  return <img src={url} alt={alt} loading="lazy" onError={() => setUrl("https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80")} />;
}

export function Promotions({ onDetails }) {
  const [filter, setFilter] = useState("all");
  const [genre, setGenre] = useState("all");
  const [state, setState] = useState({ loading: true, items: [], error: false });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));
    const params = new URLSearchParams({ filter, limit: "8" });
    if (genre !== "all") params.set("genre", genre);
    fetch(`/api/promotions?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Promoções indisponíveis"))))
      .then((payload) => setState({ loading: false, items: Array.isArray(payload.items) ? payload.items : [], error: false }))
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, items: [], error: true }); });
    return () => controller.abort();
  }, [filter, genre]);

  const genres = useMemo(() => [...new Set(state.items.flatMap((game) => game.genres || []))].sort((a, b) => a.localeCompare(b, "pt-BR")), [state.items]);

  return (
    <section className="promotions-panel" aria-label="Promoções do dia">
      <div className="section-head">
        <div>
          <span className="eyebrow">PROMOÇÕES DO DIA</span>
          <h2>Ofertas em alta agora</h2>
          <p>Descontos reais de Steam e Epic Games, atualizados pela coleta do SteamTwo.</p>
        </div>
        <div className="promo-filters">
          <div className="promotion-filter" role="tablist" aria-label="Filtrar promoções">
            {filters.map(([key, label]) => (
              <button key={key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)} role="tab" aria-selected={filter === key}>
                {label}
              </button>
            ))}
          </div>
          <label className="select-control">
            Categoria
            <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filtrar promoções por categoria">
              <option value="all">Todas as categorias</option>
              {genres.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
            <CaretDown size={16} />
          </label>
        </div>
      </div>
      {state.loading ? (
        <div className="empty-state promo-empty"><Tag size={28} /><p>Carregando promoções…</p></div>
      ) : state.items.length ? (
        <div className="promo-grid">
          {state.items.map((game) => (
            <button className="promo-card" key={game.id} onClick={() => onDetails(game)}>
              <SafeImage src={game.coverUrl} alt={`Capa de ${game.shortTitle || game.title}`} />
              {game.promotion.isFree ? (
                <span className="promo-badge promo-free-tag">Grátis</span>
              ) : (
                <span className="promo-badge">-{game.promotion.discountPercent}%</span>
              )}
              <div className="promo-card-body">
                <b>{game.shortTitle || game.title}</b>
                <span className="promo-price">
                  {!game.promotion.isFree && <del>{formatCurrency(game.promotion.initialAmount, game.promotion.currency)}</del>}
                  <ins>{game.promotion.isFree ? "Grátis" : formatCurrency(game.promotion.finalAmount, game.promotion.currency)}</ins>
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state promo-empty">
          <Tag size={28} />
          <p>{state.error ? "Não foi possível carregar as promoções agora." : "Nenhuma promoção encontrada para esse filtro."}</p>
        </div>
      )}
    </section>
  );
}
