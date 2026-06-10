import { useEffect, useRef, useState } from "react";
import { RoundHistoryPanel } from "./components/RoundHistoryPanel";
import { SessionMoodPanel } from "./components/SessionMoodPanel";
import { TrafficLight as Light } from "./components/TrafficLight";
import {
  recordSessionSample,
  summarizeSession,
  toCompletedRound,
  type CompletedRound,
  type SessionMoodSummary,
  type SessionSamples,
} from "./sessionMood";
import type { StatusResponse, TrafficLight } from "./types";

const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
const BACKEND_URL =
  import.meta.env.DEV && (envBackend === undefined || envBackend === "")
    ? "http://localhost:3000"
    : (envBackend ?? "").replace(/\/$/, "");
const API_BASE = `${BACKEND_URL}/api`;
const BACKEND_LABEL =
  BACKEND_URL === "" ? "(gleiche Origin, /api)" : API_BASE;
const POLL_INTERVAL_MS = 1_500;
const STALE_AFTER_MS = 3_000;

export function App() {
  const [displayStatus, setDisplayStatus] = useState<StatusResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [, forceTick] = useState(0);
  const inFlight = useRef(false);
  const lastKnownStatus = useRef<StatusResponse | null>(null);

  const roundSamples = useRef<SessionSamples>(new Map());
  const nextRoundId = useRef(1);
  const [currentRound, setCurrentRound] = useState<SessionMoodSummary | null>(null);
  const [completedRounds, setCompletedRounds] = useState<CompletedRound[]>([]);

  function trackRoundFrame(json: StatusResponse) {
    const light = (json.smoothedLight ?? json.light) as TrafficLight | null;
    if (json.receivedAt == null || !light) return;
    const next = recordSessionSample(roundSamples.current, json.receivedAt, light);
    if (next !== roundSamples.current) {
      roundSamples.current = next;
      setCurrentRound(summarizeSession(next));
    }
  }

  function resetCurrentRound() {
    roundSamples.current = new Map();
    setCurrentRound(null);
  }

  function endRound() {
    const summary = summarizeSession(roundSamples.current);
    if (!summary || summary.counts.total === 0) return;

    const record = toCompletedRound(nextRoundId.current, summary);
    nextRoundId.current += 1;
    setCompletedRounds((prev) => [...prev, record]);
    resetCurrentRound();
  }

  function applyStatus(json: StatusResponse) {
    const hasFrame =
      json.receivedAt !== null && json.receivedAt !== undefined;
    if (hasFrame) {
      lastKnownStatus.current = json;
      trackRoundFrame(json);
      setDisplayStatus(json);
      setPollError(null);
      return;
    }
    if (lastKnownStatus.current) {
      setDisplayStatus(lastKnownStatus.current);
    } else {
      setDisplayStatus(null);
    }
  }

  useEffect(() => {
    if (!isPolling) return;

    let cancelled = false;

    async function poll() {
      if (inFlight.current) return;
      inFlight.current = true;
      if (!cancelled) setIsFetching(true);
      try {
        const res = await fetch(`${API_BASE}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StatusResponse = await res.json();
        if (!cancelled) applyStatus(json);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setPollError(message);
          if (lastKnownStatus.current) {
            setDisplayStatus(lastKnownStatus.current);
          }
        }
      } finally {
        inFlight.current = false;
        if (!cancelled) {
          setIsFetching(false);
          forceTick((n) => n + 1);
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      setIsFetching(false);
    };
  }, [isPolling]);

  function togglePolling() {
    setIsPolling((on) => !on);
  }

  const activeLight: TrafficLight | null =
    displayStatus?.smoothedLight ?? displayStatus?.light ?? null;
  const ageMs = displayStatus?.receivedAt
    ? Date.now() - displayStatus.receivedAt
    : null;
  const isStale =
    isPolling && ageMs !== null && ageMs > STALE_AFTER_MS;
  const hasData =
    displayStatus?.receivedAt !== null &&
    displayStatus?.receivedAt !== undefined;
  const canEndRound = (currentRound?.counts.total ?? 0) > 0;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Emotion Traffic Light</h1>
        <p className="subtitle">
          Live-Stimmung des Gesprächspartners basierend auf der erkannten Mimik.
        </p>
      </header>

      <main className="page__main">
        <div className="page__visual">
          <Light active={activeLight} stale={isStale} />
          {currentRound ? (
            <SessionMoodPanel summary={currentRound} title="Aktuelle Runde" />
          ) : (
            <section className="session-mood session-mood--empty">
              <h2 className="session-mood__title">Aktuelle Runde</h2>
              <p className="session-mood__meta">
                Noch keine Frames in dieser Runde. Polling starten und Desktop-Client
                laufen lassen.
              </p>
            </section>
          )}
        </div>

        <section className="info">
          <div className="poll-controls">
            <button
              type="button"
              className={`poll-controls__btn ${isPolling ? "poll-controls__btn--stop" : ""}`}
              onClick={togglePolling}
            >
              {isPolling ? "Polling stoppen" : "Polling starten"}
            </button>
            <button
              type="button"
              className="poll-controls__btn poll-controls__btn--round"
              onClick={endRound}
              disabled={!canEndRound}
            >
              Runde beenden
            </button>
            <div className="poll-controls__status" aria-live="polite">
              <span
                className={`poll-controls__dot ${
                  isPolling
                    ? isFetching
                      ? "poll-controls__dot--fetching"
                      : "poll-controls__dot--active"
                    : "poll-controls__dot--idle"
                }`}
                aria-hidden="true"
              />
              <span className="poll-controls__label">
                {!isPolling && "Polling aus"}
                {isPolling && isFetching && "Abfrage läuft…"}
                {isPolling && !isFetching && `Polling aktiv (alle ${POLL_INTERVAL_MS / 1000}s)`}
              </span>
            </div>
          </div>

          {!isPolling && !hasData && !pollError && (
            <p className="info__hint">
              Polling ist aus. Desktop-Client starten, dann „Polling starten“ drücken.
            </p>
          )}

          {!isPolling && hasData && (
            <p className="info__hint">
              Polling pausiert — letzte bekannte Werte werden angezeigt.
            </p>
          )}

          {isPolling && !hasData && !pollError && (
            <p className="info__hint">Warte auf den ersten Frame vom Desktop-Client…</p>
          )}

          {pollError && !hasData && (
            <p className="info__error">
              Backend nicht erreichbar ({pollError}). Läuft <code>npm run dev</code> im
              backend/ Ordner?
            </p>
          )}

          {pollError && hasData && (
            <p className="info__warn">
              Aktuell kein frischer Status vom Server ({pollError}) — letzte bekannte Ampel
              bleibt sichtbar.
            </p>
          )}

          {hasData && displayStatus && (
            <dl className="info__grid">
              <div>
                <dt>Erkannte Emotion</dt>
                <dd>{displayStatus.emotion ?? "—"}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{Math.round((displayStatus.confidence ?? 0) * 100)}%</dd>
              </div>
              <div>
                <dt>Aktuelle Ampel</dt>
                <dd>{displayStatus.light ?? "—"}</dd>
              </div>
              <div>
                <dt>Geglättet (5 Frames)</dt>
                <dd>{displayStatus.smoothedLight ?? "—"}</dd>
              </div>
              <div>
                <dt>Gesicht erkannt</dt>
                <dd>{displayStatus.faceFound ? "ja" : "nein"}</dd>
              </div>
              <div>
                <dt>Letzter Frame vor</dt>
                <dd className={isStale ? "info__stale" : ""}>
                  {ageMs !== null ? `${Math.round(ageMs / 100) / 10}s` : "—"}
                </dd>
              </div>
            </dl>
          )}

          {isPolling && isStale && (
            <p className="info__warn">
              Seit über {STALE_AFTER_MS / 1000}s kein neuer Frame – Desktop-Client gestartet?
            </p>
          )}
        </section>
      </main>

      <RoundHistoryPanel rounds={completedRounds} />

      <footer className="page__footer">
        Backend: <code>{BACKEND_LABEL}</code> · Intervall: {POLL_INTERVAL_MS / 1000}s ·{" "}
        {isPolling ? (isFetching ? "Abfrage…" : "Polling an") : "Polling aus"} ·{" "}
        Runde {nextRoundId.current}
        {completedRounds.length > 0 && ` · ${completedRounds.length} beendet`}
      </footer>
    </div>
  );
}
