import { formatRoundTime, type CompletedRound } from "../sessionMood";

interface Props {
  rounds: CompletedRound[];
}

export function RoundHistoryPanel({ rounds }: Props) {
  if (rounds.length === 0) {
    return (
      <section className="round-history" aria-label="Abgeschlossene Runden">
        <h2 className="round-history__title">Abgeschlossene Runden</h2>
        <p className="round-history__empty">
          Noch keine Runde beendet. Polling starten, Frames sammeln, dann „Runde
          beenden“.
        </p>
      </section>
    );
  }

  return (
    <section className="round-history" aria-label="Abgeschlossene Runden">
      <h2 className="round-history__title">Abgeschlossene Runden ({rounds.length})</h2>
      <ol className="round-history__list">
        {[...rounds].reverse().map((round) => (
          <li key={round.id} className="round-history__item">
            <div className="round-history__head">
              <span className="round-history__name">Runde {round.id}</span>
              <span className="round-history__time">{formatRoundTime(round.endedAt)}</span>
            </div>
            <p
              className={`round-history__verdict round-history__verdict--${round.overall}`}
            >
              {round.label}
            </p>
            <p className="round-history__counts">
              <strong>{round.counts.total}</strong> Frames gesamt ·{" "}
              <span className="round-history__green">{round.counts.green} grün</span>
              {" · "}
              <span className="round-history__yellow">{round.counts.yellow} gelb</span>
              {" · "}
              <span className="round-history__red">{round.counts.red} rot</span>
            </p>
            <p className="round-history__detail">{round.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
