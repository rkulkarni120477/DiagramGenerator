import type { DiagramTurn } from "@/lib/types";

export function AssumptionsPanel({ turn }: { turn: DiagramTurn }) {
  return (
    <section className="card" aria-labelledby="assumptions-heading">
      <h2 id="assumptions-heading">Assumptions</h2>
      {turn.assumptions.length > 0 ? (
        <ul>
          {turn.assumptions.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No assumptions were needed.</p>
      )}

      {turn.constraints_applied.length > 0 && (
        <>
          <h3>Constraints applied</h3>
          <ul>
            {turn.constraints_applied.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {turn.notes && <p className="notes">{turn.notes}</p>}
    </section>
  );
}
