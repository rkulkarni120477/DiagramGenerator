"use client";

import { useEffect, useRef, useState } from "react";
import { prepareSvg } from "@/lib/export";

interface Props {
  code: string;
  onRendered: (svg: string) => void;
  onError: (message: string) => void;
}

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        // Strict mode disables click handlers and HTML labels, which keeps untrusted diagram text inert.
        securityLevel: "strict",
        theme: "base",
        fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        themeVariables: {
          fontSize: "16px",
          primaryColor: "#eef4ff",
          primaryBorderColor: "#3b5bdb",
          primaryTextColor: "#1f2937",
          lineColor: "#64748b",
          clusterBkg: "#f8fafc",
          clusterBorder: "#cbd5e1",
          background: "#ffffff",
        },
        // SVG text labels (not foreignObject) keep the diagram exportable to canvas.
        flowchart: { htmlLabels: false, curve: "basis" },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

let renderCounter = 0;

export function MermaidDiagram({ code, onRendered, onError }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callbacks without re-running the render effect.
  const onRenderedRef = useRef(onRendered);
  const onErrorRef = useRef(onError);
  onRenderedRef.current = onRendered;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    const id = `diagram-${++renderCounter}`;

    (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: rendered } = await mermaid.render(id, code);
        if (cancelled) return;
        setError(null);
        setSvg(rendered);
        onRenderedRef.current(rendered);
      } catch (err) {
        // Mermaid can leave its temporary error element in the DOM; remove it.
        document.getElementById(`d${id}`)?.remove();
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setSvg(null);
        setError(message);
        onErrorRef.current(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="error-box" role="alert">
        <strong>The diagram could not be rendered.</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return <p className="muted">Rendering diagram…</p>;
  }

  return <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: prepareSvg(svg).markup }} />;
}
