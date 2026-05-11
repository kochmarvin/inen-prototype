import { useEffect, useRef, useState } from "react";
import { TrafficLight as Light } from "./components/TrafficLight";
import type { StatusResponse, TrafficLight } from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 500;
// If no fresh frame has arrived within this many ms, we visually mark the
// signal as stale instead of pretending the last detection is still valid.
const STALE_AFTER_MS = 3_000;

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0); // re-render every poll for the "age" counter
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch(`${BACKEND_URL}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StatusResponse = await res.json();
        if (!cancelled) {
          setStatus(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        inFlight.current = false;
        if (!cancelled) forceTick((n) => n + 1);
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const activeLight: TrafficLight | null =
    status?.smoothedLight ?? status?.light ?? null;
  const ageMs = status?.receivedAt ? Date.now() - status.receivedAt : null;
  const isStale = ageMs !== null && ageMs > STALE_AFTER_MS;
  const hasData = status?.receivedAt !== null && status?.receivedAt !== undefined;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Emotion Traffic Light</h1>
        <p className="subtitle">
          Live-Stimmung des Gesprächspartners basierend auf der erkannten Mimik.
        </p>
      </header>

      <main className="page__main">
        <Light active={isStale ? null : activeLight} />

        <section className="info">
          {!hasData && !error && (
            <p className="info__hint">Warte auf den ersten Frame vom Desktop-Client…</p>
          )}

          {error && (
            <p className="info__error">
              Backend nicht erreichbar ({error}). Läuft <code>npm run dev</code> im
              backend/ Ordner?
            </p>
          )}

          {hasData && status && (
            <dl className="info__grid">
              <div>
                <dt>Erkannte Emotion</dt>
                <dd>{status.emotion ?? "—"}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{Math.round((status.confidence ?? 0) * 100)}%</dd>
              </div>
              <div>
                <dt>Aktuelle Ampel</dt>
                <dd>{status.light ?? "—"}</dd>
              </div>
              <div>
                <dt>Geglättet (5 Frames)</dt>
                <dd>{status.smoothedLight ?? "—"}</dd>
              </div>
              <div>
                <dt>Gesicht erkannt</dt>
                <dd>{status.faceFound ? "ja" : "nein"}</dd>
              </div>
              <div>
                <dt>Letzter Frame vor</dt>
                <dd className={isStale ? "info__stale" : ""}>
                  {ageMs !== null ? `${Math.round(ageMs / 100) / 10}s` : "—"}
                </dd>
              </div>
            </dl>
          )}

          {isStale && (
            <p className="info__warn">
              Seit über {STALE_AFTER_MS / 1000}s kein neuer Frame – Desktop-Client gestartet?
            </p>
          )}
        </section>
      </main>

      <footer className="page__footer">
        Backend: <code>{BACKEND_URL}</code> · Poll: {POLL_INTERVAL_MS}ms
      </footer>
    </div>
  );
}
