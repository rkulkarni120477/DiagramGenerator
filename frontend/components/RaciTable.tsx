import { RACI_COLORS, RACI_LEGEND } from "@/lib/raci";
import type { RaciDiagram } from "@/lib/types";

export function RaciTable({ turn }: { turn: RaciDiagram }) {
  return (
    <div className="raci">
      <table>
        <thead>
          <tr>
            <th scope="col">Task</th>
            {turn.roles.map((role) => (
              <th key={role} scope="col">
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {turn.tasks.map((task, rowIndex) => (
            <tr key={`${rowIndex}-${task.task}`}>
              <th scope="row">{task.task}</th>
              {turn.roles.map((role) => {
                const code = task.assignments[role];
                return (
                  <td key={role} className="code-cell">
                    {code && (
                      <span
                        className="code"
                        style={{ background: RACI_COLORS[code].background, color: RACI_COLORS[code].text }}
                      >
                        {code}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="raci-legend" aria-label="Legend">
        {RACI_LEGEND.map((item) => (
          <li key={item.code}>
            <span
              className="code"
              style={{ background: RACI_COLORS[item.code].background, color: RACI_COLORS[item.code].text }}
            >
              {item.code}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
