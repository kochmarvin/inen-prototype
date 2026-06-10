import type { SessionMoodSummary } from "../sessionMood";

interface Props {
  summary: SessionMoodSummary;
  title?: string;
  metaLabel?: string;
}

export function SessionMoodPanel({
  summary,
  title = "Aktuelle Runde",
  metaLabel,
}: Props) {
  const { counts, overall, label, detail } = summary;
  const total = counts.total || 1;
  const meta =
    metaLabel ??
    `${counts.total} ${counts.total === 1 ? "Frame" : "Frames"} · ${counts.green} grün · ${counts.yellow} gelb · ${counts.red} rot`;

  return (
    <section
      className="session-mood"
      aria-label={`${title}: ${label}`}
    >
      <h2 className="session-mood__title">{title}</h2>
      <p className={`session-mood__verdict session-mood__verdict--${overall}`}>
        {label}
      </p>
      <div className="session-mood__bar" role="img" aria-label={detail}>
        {counts.green > 0 && (
          <span
            className="session-mood__segment session-mood__segment--green"
            style={{ flexGrow: counts.green / total }}
          />
        )}
        {counts.yellow > 0 && (
          <span
            className="session-mood__segment session-mood__segment--yellow"
            style={{ flexGrow: counts.yellow / total }}
          />
        )}
        {counts.red > 0 && (
          <span
            className="session-mood__segment session-mood__segment--red"
            style={{ flexGrow: counts.red / total }}
          />
        )}
      </div>
      <p className="session-mood__detail">{detail}</p>
      <p className="session-mood__meta">{meta}</p>
    </section>
  );
}
