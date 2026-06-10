import type { TrafficLight as TrafficLightValue } from "../types";

interface Lamp {
  id: TrafficLightValue;
  emoji: string;
  label: string;
}

const LAMPS: Lamp[] = [
  { id: "green", emoji: "😀", label: "positiv" },
  { id: "yellow", emoji: "😐", label: "neutral" },
  { id: "red", emoji: "😞", label: "negativ" },
];

interface Props {
  active: TrafficLightValue | null;
  /** No new frame for a while — keep showing active lamp, slightly dimmed. */
  stale?: boolean;
}

export function TrafficLight({ active, stale = false }: Props) {
  return (
    <div
      className={`traffic-light${stale ? " traffic-light--stale" : ""}`}
      role="img"
      aria-label={`Stimmung: ${active ?? "unbekannt"}${stale ? " (veraltet)" : ""}`}
    >
      <div className="traffic-light__pole">
        {LAMPS.map((lamp) => {
          const isActive = lamp.id === active;
          return (
            <div
              key={lamp.id}
              className={`lamp lamp--${lamp.id} ${isActive ? "lamp--active" : "lamp--dim"}`}
            >
              <span className="lamp__emoji" aria-hidden="true">
                {lamp.emoji}
              </span>
              <span className="lamp__label">{lamp.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
