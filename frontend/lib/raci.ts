import type { RaciCode, RaciDiagram } from "@/lib/types";

export const RACI_LEGEND: { code: RaciCode; label: string }[] = [
  { code: "R", label: "Responsible" },
  { code: "A", label: "Accountable" },
  { code: "A/R", label: "Accountable and responsible" },
  { code: "C", label: "Consulted" },
  { code: "I", label: "Informed" },
];

export const RACI_COLORS: Record<RaciCode, { background: string; text: string }> = {
  R: { background: "#dbeafe", text: "#1e40af" },
  A: { background: "#fde68a", text: "#92400e" },
  "A/R": { background: "#a7f3d0", text: "#065f46" },
  C: { background: "#ede9fe", text: "#5b21b6" },
  I: { background: "#e2e8f0", text: "#334155" },
};

const FONT = "Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const PADDING = 32;
const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 44;
const ROLE_WIDTH = 150;
const CELL_SIZE = 32;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renders the RACI matrix as standalone SVG so it can be exported like a Mermaid diagram. */
export function buildRaciSvg(turn: RaciDiagram): string {
  const taskColumnWidth = Math.max(260, ...turn.tasks.map((t) => t.task.length * 8 + 32));
  const tableWidth = taskColumnWidth + turn.roles.length * ROLE_WIDTH;
  const tableTop = PADDING + 40;
  const legendTop = tableTop + HEADER_HEIGHT + turn.tasks.length * ROW_HEIGHT + 28;
  const width = tableWidth + PADDING * 2;
  const height = legendTop + 40;

  const parts: string[] = [];
  parts.push(
    `<text x="${PADDING}" y="${PADDING + 16}" font-family="${FONT}" font-size="20" font-weight="600" fill="#0f172a">${escapeXml(turn.title)}</text>`,
  );

  // Header row
  parts.push(
    `<rect x="${PADDING}" y="${tableTop}" width="${tableWidth}" height="${HEADER_HEIGHT}" fill="#1e3a8a"/>`,
    `<text x="${PADDING + 16}" y="${tableTop + HEADER_HEIGHT / 2 + 5}" font-family="${FONT}" font-size="14" font-weight="600" fill="#ffffff">Task</text>`,
  );
  turn.roles.forEach((role, i) => {
    const x = PADDING + taskColumnWidth + i * ROLE_WIDTH + ROLE_WIDTH / 2;
    parts.push(
      `<text x="${x}" y="${tableTop + HEADER_HEIGHT / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="#ffffff">${escapeXml(role)}</text>`,
    );
  });

  // Body rows
  turn.tasks.forEach((task, rowIndex) => {
    const y = tableTop + HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    const fill = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
    parts.push(`<rect x="${PADDING}" y="${y}" width="${tableWidth}" height="${ROW_HEIGHT}" fill="${fill}" stroke="#e2e8f0"/>`);
    parts.push(
      `<text x="${PADDING + 16}" y="${y + ROW_HEIGHT / 2 + 5}" font-family="${FONT}" font-size="14" fill="#0f172a">${escapeXml(task.task)}</text>`,
    );
    turn.roles.forEach((role, i) => {
      const code = task.assignments[role];
      if (!code) return;
      const colors = RACI_COLORS[code];
      const cellX = PADDING + taskColumnWidth + i * ROLE_WIDTH + (ROLE_WIDTH - CELL_SIZE * 1.6) / 2;
      const cellY = y + (ROW_HEIGHT - CELL_SIZE) / 2;
      parts.push(
        `<rect x="${cellX}" y="${cellY}" width="${CELL_SIZE * 1.6}" height="${CELL_SIZE}" rx="6" fill="${colors.background}"/>`,
        `<text x="${cellX + (CELL_SIZE * 1.6) / 2}" y="${cellY + CELL_SIZE / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${colors.text}">${code}</text>`,
      );
    });
  });

  // Legend
  let legendX = PADDING;
  for (const item of RACI_LEGEND) {
    const colors = RACI_COLORS[item.code];
    parts.push(
      `<rect x="${legendX}" y="${legendTop}" width="28" height="20" rx="4" fill="${colors.background}"/>`,
      `<text x="${legendX + 14}" y="${legendTop + 14}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="${colors.text}">${item.code}</text>`,
      `<text x="${legendX + 36}" y="${legendTop + 14}" font-family="${FONT}" font-size="12" fill="#334155">${escapeXml(item.label)}</text>`,
    );
    legendX += 36 + item.label.length * 7 + 28;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    ...parts,
    `</svg>`,
  ].join("");
}
