import { diagramTypeLabel, type SessionSummary } from "@/lib/types";

interface Props {
  sessions: SessionSummary[];
  activeId: string | null;
  disabled: boolean;
  onOpen: (id: string) => void;
}

export function SessionList({ sessions, activeId, disabled, onOpen }: Props) {
  return (
    <section className="card" aria-labelledby="history-heading">
      <h2 id="history-heading">Recent diagrams</h2>
      {sessions.length === 0 ? (
        <p className="muted">Diagrams you generate will appear here.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className={`session-item ${session.id === activeId ? "active" : ""}`}
                onClick={() => onOpen(session.id)}
                disabled={disabled}
              >
                <span className="session-title">{session.title}</span>
                <span className="muted small">
                  {diagramTypeLabel(session.diagram_type)} · {new Date(session.updated_at).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
