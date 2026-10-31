import type { LayerComponent, LayeredDiagram } from "@/lib/types";

/**
 * Draws a layered architecture as standalone SVG: stacked layers from top (request entry) to
 * bottom (data), components inside each layer, a Closed/Open badge per layer, dashed arrows
 * showing the request path, and cross-cutting concerns as columns beside the stack.
 */

const FONT = "Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const PAD = 24;
const TITLE_HEIGHT = 44;
const ENTRY_HEIGHT = 56;
const LAYER_HEIGHT = 96;
const LAYER_GAP = 44;
const LABEL_WIDTH = 190;
const COMPONENT_WIDTH = 150;
const COMPONENT_HEIGHT = 46;
const DATABASE_HEIGHT = 60;
const COMPONENT_GAP = 20;
const BADGE_WIDTH = 76;
const BADGE_HEIGHT = 26;
const CROSS_WIDTH = 170;
const CROSS_GAP = 16;
const CROSS_TITLE_HEIGHT = 56;
const CROSS_ITEM_HEIGHT = 60;
const CYLINDER_RY = 8;

const LAYER_FILL = "#dcd3ec";
const LAYER_BORDER = "#8e7fb0";
const COMPONENT_FILLS = ["#c3ccd6", "#a9dcef", "#f7d7a4", "#c9e8c0"];
const COMPONENT_BORDER = "#64748b";
const ARROW = "#b91c1c";
const CLOSED = "#dc2626";
const OPEN = "#e2e8f0";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Splits a label into at most two lines so names fit inside their boxes. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) {
    return [lines[0], `${lines[1].slice(0, maxChars - 1)}…`];
  }
  return lines;
}

/** Accent colour for a hosting provider, so the badge is recognisable at a glance. */
function providerColor(provider: string): string {
  const name = provider.toLowerCase();
  if (name.includes("aws") || name.includes("amazon")) return "#ea8c00";
  if (name.includes("azure") || name.includes("microsoft")) return "#0078d4";
  if (name.includes("google") || name.includes("gcp")) return "#1a73e8";
  return "#475569";
}

/** Cloud icon, drawn as a path so it works inside the exported image. */
function cloudIcon(x: number, y: number, size: number, color: string): string {
  const scale = size / 24;
  return `<g transform="translate(${x},${y}) scale(${scale})"><path d="M6.5 19a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.6 8.5 4.5 4.5 0 0 1 17.5 19z" fill="${color}"/></g>`;
}

/** Hosting badge placed at the top right of the diagram, beside the title. */
function hostingBadge(hosting: { provider: string; region?: string | null }, right: number): { svg: string; width: number } {
  const label = hosting.region ? `Hosted on ${hosting.provider} · ${hosting.region}` : `Hosted on ${hosting.provider}`;
  const color = providerColor(hosting.provider);
  const width = Math.max(180, label.length * 7.4 + 44);
  const height = 30;
  const x = right - width;
  const y = PAD + 6;
  const svg = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`,
    cloudIcon(x + 12, y + 5, 20, color),
    `<text x="${x + 38}" y="${y + height / 2 + 5}" font-family="${FONT}" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(label)}</text>`,
  ].join("");
  return { svg, width };
}

function textBlock(
  lines: string[],
  x: number,
  centerY: number,
  options: { anchor: "middle" | "start"; size: number; weight?: number; fill: string },
): string {
  const lineHeight = options.size * 1.25;
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2 + options.size * 0.35;
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text font-family="${FONT}" font-size="${options.size}" font-weight="${options.weight ?? 400}" fill="${options.fill}" text-anchor="${options.anchor}">${tspans}</text>`;
}

function drawComponent(component: LayerComponent, centerX: number, centerY: number, fill: string): string {
  const lines = wrap(component.name, 18);
  if (component.kind === "database") {
    const width = COMPONENT_WIDTH - 30;
    const left = centerX - width / 2;
    const top = centerY - DATABASE_HEIGHT / 2;
    const right = left + width;
    const bottomY = top + DATABASE_HEIGHT - CYLINDER_RY;
    const topY = top + CYLINDER_RY;
    const body = `M${left},${topY} L${left},${bottomY} A${width / 2},${CYLINDER_RY} 0 0 0 ${right},${bottomY} L${right},${topY} Z`;
    return [
      `<path d="${body}" fill="${fill}" stroke="${COMPONENT_BORDER}" stroke-width="1.5"/>`,
      `<ellipse cx="${centerX}" cy="${topY}" rx="${width / 2}" ry="${CYLINDER_RY}" fill="${fill}" stroke="${COMPONENT_BORDER}" stroke-width="1.5"/>`,
      textBlock(lines, centerX, centerY + CYLINDER_RY / 2, { anchor: "middle", size: 13, fill: "#0f172a" }),
    ].join("");
  }
  return [
    `<rect x="${centerX - COMPONENT_WIDTH / 2}" y="${centerY - COMPONENT_HEIGHT / 2}" width="${COMPONENT_WIDTH}" height="${COMPONENT_HEIGHT}" rx="6" fill="${fill}" stroke="${COMPONENT_BORDER}" stroke-width="1.2"/>`,
    textBlock(lines, centerX, centerY, { anchor: "middle", size: 13, fill: "#0f172a" }),
  ].join("");
}

export function buildLayeredSvg(turn: LayeredDiagram): string {
  const maxComponents = Math.max(1, ...turn.layers.map((layer) => layer.components.length));
  const componentsWidth = maxComponents * (COMPONENT_WIDTH + COMPONENT_GAP) - COMPONENT_GAP;
  const layersWidth = LABEL_WIDTH + componentsWidth + 16 + BADGE_WIDTH + 16;
  const stackTop = PAD + TITLE_HEIGHT + ENTRY_HEIGHT;
  const layerTop = (index: number) => stackTop + index * (LAYER_HEIGHT + LAYER_GAP);
  const stackBottom = layerTop(turn.layers.length - 1) + LAYER_HEIGHT;

  // Cross-cutting columns sit to the right of the stack and must fit their own items.
  const crossBottom = Math.max(
    stackBottom,
    ...turn.cross_cutting.map((concern) => stackTop + CROSS_TITLE_HEIGHT + concern.components.length * CROSS_ITEM_HEIGHT),
  );
  const crossWidth =
    turn.cross_cutting.length > 0 ? 28 + turn.cross_cutting.length * CROSS_WIDTH + (turn.cross_cutting.length - 1) * CROSS_GAP : 0;
  const width = PAD * 2 + layersWidth + crossWidth;
  const height = crossBottom + PAD;

  const parts: string[] = [];
  parts.push(
    `<text x="${PAD}" y="${PAD + 24}" font-family="${FONT}" font-size="20" font-weight="600" fill="#0f172a">${escapeXml(turn.title)}</text>`,
  );
  if (turn.hosting) {
    parts.push(hostingBadge(turn.hosting, width - PAD).svg);
  }

  // Request entry and the dashed arrows between layers.
  const arrowX = PAD + LABEL_WIDTH - 40;
  parts.push(
    `<text x="${arrowX}" y="${PAD + TITLE_HEIGHT + 10}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="#0f172a">${escapeXml(turn.entry_point)}</text>`,
    `<line x1="${arrowX}" y1="${PAD + TITLE_HEIGHT + 20}" x2="${arrowX}" y2="${stackTop - 6}" stroke="${ARROW}" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#layered-arrow)"/>`,
  );
  turn.layers.forEach((_layer, index) => {
    if (index === turn.layers.length - 1) return;
    const from = layerTop(index) + LAYER_HEIGHT;
    const to = layerTop(index + 1);
    parts.push(
      `<line x1="${arrowX}" y1="${from}" x2="${arrowX}" y2="${to - 6}" stroke="${ARROW}" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#layered-arrow)"/>`,
    );
  });

  // Layers, with components and the Closed/Open badge.
  turn.layers.forEach((layer, index) => {
    const top = layerTop(index);
    const centerY = top + LAYER_HEIGHT / 2;
    const fill = COMPONENT_FILLS[index % COMPONENT_FILLS.length];
    parts.push(
      `<rect x="${PAD}" y="${top}" width="${layersWidth}" height="${LAYER_HEIGHT}" rx="2" fill="${LAYER_FILL}" stroke="${LAYER_BORDER}" stroke-width="1.2"/>`,
      textBlock(wrap(layer.name, 20), PAD + 14, centerY, { anchor: "start", size: 15, weight: 600, fill: "#1e1b4b" }),
    );
    layer.components.forEach((component, slot) => {
      const centerX = PAD + LABEL_WIDTH + slot * (COMPONENT_WIDTH + COMPONENT_GAP) + COMPONENT_WIDTH / 2;
      parts.push(drawComponent(component, centerX, centerY, fill));
    });

    const badgeX = PAD + layersWidth - BADGE_WIDTH - 16;
    parts.push(
      `<rect x="${badgeX}" y="${centerY - BADGE_HEIGHT / 2}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="4" fill="${layer.closed ? CLOSED : OPEN}"/>`,
      textBlock([layer.closed ? "Closed" : "Open"], badgeX + BADGE_WIDTH / 2, centerY, {
        anchor: "middle",
        size: 13,
        weight: 600,
        fill: layer.closed ? "#ffffff" : "#334155",
      }),
    );
  });

  // Cross-cutting concerns as columns beside the stack.
  turn.cross_cutting.forEach((concern, index) => {
    const x = PAD + layersWidth + 28 + index * (CROSS_WIDTH + CROSS_GAP);
    const top = stackTop;
    const columnHeight = crossBottom - top;
    parts.push(
      `<rect x="${x}" y="${top}" width="${CROSS_WIDTH}" height="${columnHeight}" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/>`,
      textBlock(wrap(concern.name, 22), x + CROSS_WIDTH / 2, top + 26, {
        anchor: "middle",
        size: 14,
        weight: 600,
        fill: "#1e293b",
      }),
    );
    concern.components.forEach((component, slot) => {
      const centerY = top + CROSS_TITLE_HEIGHT + slot * CROSS_ITEM_HEIGHT + COMPONENT_HEIGHT / 2;
      parts.push(drawComponent(component, x + CROSS_WIDTH / 2, centerY, "#e2e8f0"));
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<defs><marker id="layered-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ARROW}"/></marker></defs>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="10" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`,
    ...parts,
    `</svg>`,
  ].join("");
}
