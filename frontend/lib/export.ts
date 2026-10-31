/**
 * Image export for rendered diagrams. Everything works from the SVG markup so the same
 * code path handles Mermaid output and the RACI matrix.
 */

const EXPORT_SCALE = 2;

interface PreparedSvg {
  width: number;
  height: number;
  markup: string;
}

/** Gives the SVG explicit pixel dimensions taken from its viewBox. */
export function prepareSvg(svg: string): PreparedSvg {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const width = viewBox && viewBox.length === 4 ? viewBox[2] : Number(root.getAttribute("width")) || 1000;
  const height = viewBox && viewBox.length === 4 ? viewBox[3] : Number(root.getAttribute("height")) || 600;

  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.removeAttribute("style");

  return { width, height, markup: new XMLSerializer().serializeToString(root) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The diagram could not be converted to an image."));
    image.src = url;
  });
}

/** Draws the SVG onto a white canvas at 2x resolution (JPG and PNG have no transparency here). */
async function svgToCanvas(svg: string): Promise<HTMLCanvasElement> {
  const { width, height, markup } = prepareSvg(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * EXPORT_SCALE);
    canvas.height = Math.ceil(height * EXPORT_SCALE);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded."))),
      type,
      quality,
    );
  });
}

/** Copies the diagram as PNG. Clipboard image support requires PNG, not JPEG. */
export async function copyPngToClipboard(svg: string): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Copying images is not supported in this browser. Use Download instead.");
  }
  // Pass a promise so the clipboard write starts inside the click gesture (required by Safari).
  const pngBlob = svgToCanvas(svg).then((canvas) => canvasToBlob(canvas, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
}

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("Copying is not supported in this browser.");
  }
  await navigator.clipboard.writeText(text);
}

interface SaveFileHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<SaveFileHandle>;

/**
 * Saves the diagram as JPG. Returns false when the user cancels the Save As dialog.
 * On browsers without showSaveFilePicker (Firefox, Safari) it falls back to a normal download.
 */
export async function downloadJpg(svg: string, suggestedName: string): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

  // The picker must open synchronously inside the click, before any await, so the browser
  // still considers the user gesture active.
  let handlePromise: Promise<SaveFileHandle> | null = null;
  if (picker) {
    handlePromise = picker({
      suggestedName,
      types: [{ description: "JPEG image", accept: { "image/jpeg": [".jpg"] } }],
    });
  }

  let handle: SaveFileHandle | null = null;
  if (handlePromise) {
    try {
      handle = await handlePromise;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      throw err;
    }
  }

  const canvas = await svgToCanvas(svg);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);

  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
