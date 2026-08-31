import { useEffect, useMemo, useState } from "react";
import { ChartLineUp } from "@phosphor-icons/react";

const WIDTH = 760;
const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 28, left: 12 };

const formatShortDate = (date) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
};

function buildGeometry(points) {
  const scores = points.map((point) => point.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const coords = points.map((point, index) => ({
    ...point,
    x: PADDING.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
    y: PADDING.top + innerHeight - ((point.score - min) / range) * innerHeight,
  }));
  return { coords, min, max };
}

export function PopularityChart({ slug }) {
  const [state, setState] = useState({ loading: true, points: [], error: false });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, points: [], error: false });
    setHoverIndex(null);
    fetch(`/api/games/${encodeURIComponent(slug)}/history?days=90`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Histórico indisponível"))))
      .then((payload) => setState({ loading: false, points: Array.isArray(payload.points) ? payload.points : [], error: false }))
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, points: [], error: true }); });
    return () => controller.abort();
  }, [slug]);

  const geometry = useMemo(() => (state.points.length >= 2 ? buildGeometry(state.points) : null), [state.points]);

  return (
    <section className="popularity-chart" aria-label="Popularidade histórica">
      <div className="section-head">
        <div>
          <span className="eyebrow">TENDÊNCIA</span>
          <h2>Popularidade histórica</h2>
          <p>Índice SteamTwo combinado ao longo dos últimos snapshots coletados.</p>
        </div>
      </div>
      {state.loading ? (
        <div className="chart-empty">
          <ChartLineUp size={28} />
          <p>Carregando histórico…</p>
        </div>
      ) : geometry ? (
        <div className="chart-canvas">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Gráfico de linha da popularidade ao longo do tempo">
            {[0, 0.5, 1].map((fraction) => {
              const y = PADDING.top + (HEIGHT - PADDING.top - PADDING.bottom) * fraction;
              return <line key={fraction} className="chart-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} />;
            })}
            <polyline
              className="chart-line"
              fill="none"
              points={geometry.coords.map((point) => `${point.x},${point.y}`).join(" ")}
            />
            {geometry.coords.map((point, index) => (
              <g key={point.date}>
                <circle
                  className={`chart-point ${hoverIndex === index ? "active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={hoverIndex === index ? 4.5 : 3}
                  tabIndex={0}
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
                  onBlur={() => setHoverIndex((current) => (current === index ? null : current))}
                />
              </g>
            ))}
          </svg>
          <div className="chart-axis-labels">
            <span>{formatShortDate(geometry.coords[0].date)}</span>
            <span>{formatShortDate(geometry.coords[geometry.coords.length - 1].date)}</span>
          </div>
          {hoverIndex != null && (
            <div
              className="chart-tooltip"
              style={{ left: `${(geometry.coords[hoverIndex].x / WIDTH) * 100}%`, top: `${(geometry.coords[hoverIndex].y / HEIGHT) * 100}%` }}
            >
              <b>{geometry.coords[hoverIndex].score.toFixed(1).replace(".", ",")}</b>
              <span>{formatShortDate(geometry.coords[hoverIndex].date)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="chart-empty">
          <ChartLineUp size={28} />
          <p>{state.error ? "Não foi possível carregar o histórico agora." : "Histórico insuficiente para este jogo ainda."}</p>
        </div>
      )}
    </section>
  );
}
