"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { ClarificationForm } from "@/components/ClarificationForm";
import { DiagramCanvas } from "@/components/DiagramCanvas";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { PromptPanel } from "@/components/PromptPanel";
import { RaciTable } from "@/components/RaciTable";
import { RefineForm } from "@/components/RefineForm";
import { SessionList } from "@/components/SessionList";
import { ProgressPanel } from "@/components/ProgressPanel";
import { api, messageOf, newProgressId } from "@/lib/api";
import { copyPngToClipboard, copyText, downloadJpg } from "@/lib/export";
import { buildRaciSvg } from "@/lib/raci";
import { SamplePrompts } from "@/components/SamplePrompts";
import {
  DIAGRAM_TYPE_LABELS,
  isUntouchedPrompt,
  MAX_PROMPT_CHARS,
  TEMPLATES,
  type SamplePrompt,
} from "@/lib/prompt-template";
import {
  diagramTypeLabel,
  type AgentTurn,
  type DiagramTurn,
  type DiagramType,
  type SessionSummary,
  type TurnResponse,
} from "@/lib/types";

const MAX_REPAIRS_PER_GENERATION = 1;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sourceOf(turn: DiagramTurn): string {
  return turn.format === "mermaid" ? turn.mermaid : JSON.stringify(turn, null, 2);
}

export default function Home() {
  const [diagramType, setDiagramType] = useState<DiagramType>("technical");
  const [prompt, setPrompt] = useState(TEMPLATES.technical);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [diagramId, setDiagramId] = useState<number | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Mermaid repairs used for the current generation. Reset whenever the user sends new input.
  const repairsUsed = useRef(0);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
    } catch {
      // History is non-critical; keep whatever is already shown.
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Runs an API call that returns a new turn and updates the page with the result. */
  const perform = async (
    label: string,
    action: (progressId: string) => Promise<TurnResponse>,
    options: { isNewInput: boolean },
  ) => {
    const id = newProgressId();
    setBusy(label);
    setProgressId(id);
    setError(null);
    try {
      const response = await action(id);
      if (options.isNewInput) repairsUsed.current = 0;
      setSessionId(response.session_id);
      setTurn(response.turn);
      setDiagramId(response.diagram_id);
      setRenderedSvg(null);
      void refreshSessions();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(null);
      setProgressId(null);
    }
  };

  /**
   * Loads text into the editor for a diagram type. Untouched templates and samples are replaced
   * silently. Anything the user typed is only replaced after confirmation.
   */
  const loadPrompt = (type: DiagramType, text: string, replaceConfirmation: string) => {
    if (isUntouchedPrompt(prompt) || window.confirm(replaceConfirmation)) {
      setPrompt(text);
      setDiagramType(type);
    }
  };

  const handleTypeChange = (type: DiagramType) => {
    if (type === diagramType) return;
    loadPrompt(type, TEMPLATES[type], `Replace your prompt with the ${DIAGRAM_TYPE_LABELS[type]} template?`);
  };

  const handleUseSample = (type: DiagramType, sample: SamplePrompt) => {
    loadPrompt(type, sample.prompt, `Replace your prompt with the sample "${sample.title}"?`);
  };

  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text) {
      setError("Enter a prompt before generating.");
      return;
    }
    if (text.length > MAX_PROMPT_CHARS) {
      setError(`The prompt is over the ${MAX_PROMPT_CHARS.toLocaleString()} character limit.`);
      return;
    }
    void perform("Generating diagram…", (id) => api.createSession(diagramType, text, id), { isNewInput: true });
  };

  const handleAnswers = (answers: string) => {
    if (!sessionId) return;
    void perform("Sending answers…", (id) => api.sendMessage(sessionId, answers, id), { isNewInput: true });
  };

  const handleRefine = (text: string) => {
    if (!sessionId) return;
    void perform("Updating diagram…", (id) => api.sendMessage(sessionId, text, id), { isNewInput: true });
  };

  const handleRenderError = (message: string) => {
    // Send the Mermaid error back to the model once. A second failure is shown to the user.
    if (!sessionId || repairsUsed.current >= MAX_REPAIRS_PER_GENERATION) return;
    repairsUsed.current += 1;
    void perform("Repairing diagram…", (id) => api.repair(sessionId, message, id), { isNewInput: false });
  };

  const openSession = async (id: string) => {
    setBusy("Loading diagram…");
    setError(null);
    try {
      const detail = await api.getSession(id);
      setSessionId(detail.id);
      setDiagramType(detail.diagram_type);
      setTurn(detail.latest_turn);
      setDiagramId(detail.latest_diagram_id);
      setRenderedSvg(null);
      repairsUsed.current = 0;
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(null);
    }
  };

  const newDiagram = () => {
    setSessionId(null);
    setTurn(null);
    setDiagramId(null);
    setRenderedSvg(null);
    setError(null);
    setPrompt(TEMPLATES[diagramType]);
  };

  const diagramTurn = turn?.status === "diagram" ? turn : null;
  // RACI matrices are rendered from data, so their SVG is built here rather than by Mermaid.
  const exportSvg = diagramTurn
    ? diagramTurn.format === "raci_matrix"
      ? buildRaciSvg(diagramTurn)
      : renderedSvg
    : null;
  const fileName = `${diagramType}-diagram-${today()}.jpg`;

  const handleCopyPng = async () => {
    if (!exportSvg) return;
    try {
      await copyPngToClipboard(exportSvg);
      setToast("Diagram copied as PNG");
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handleCopySource = async () => {
    if (!diagramTurn) return;
    try {
      await copyText(sourceOf(diagramTurn));
      setToast(diagramTurn.format === "mermaid" ? "Mermaid source copied" : "Matrix data copied as JSON");
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handleDownload = async () => {
    if (!exportSvg) return;
    try {
      // A cancelled Save As dialog returns false and is deliberately silent.
      const saved = await downloadJpg(exportSvg, fileName);
      if (saved) setToast("Diagram saved as JPG");
    } catch (err) {
      setError(`Download failed. ${messageOf(err)}`);
    }
  };

  const renderResult = () => {
    if (!turn) {
      return (
        <section className="card empty">
          <h2>Your diagram appears here</h2>
          <p className="muted">
            Choose a diagram type, describe the system in the prompt editor, and select Generate. The assistant may ask a
            few clarifying questions first.
          </p>
        </section>
      );
    }

    if (turn.status === "needs_clarification") {
      return <ClarificationForm turn={turn} disabled={!!busy} onSubmit={handleAnswers} />;
    }

    return (
      <div className="diagram-view">
        <div className="card diagram-header">
          <div>
            <h2>{turn.title}</h2>
            <span className="muted small">{diagramTypeLabel(turn.diagram_type)} diagram</span>
          </div>
          <div className="actions">
            <button type="button" onClick={handleCopyPng} disabled={!exportSvg || !!busy}>
              Copy
            </button>
            <button type="button" onClick={handleCopySource} disabled={!!busy}>
              Copy source
            </button>
            <button type="button" className="primary" onClick={handleDownload} disabled={!exportSvg || !!busy}>
              Download JPG
            </button>
          </div>
        </div>

        <DiagramCanvas resetKey={String(diagramId)}>
          {turn.format === "raci_matrix" ? (
            <RaciTable turn={turn} />
          ) : (
            <MermaidDiagram
              key={diagramId ?? "none"}
              code={turn.mermaid}
              onRendered={setRenderedSvg}
              onError={handleRenderError}
            />
          )}
        </DiagramCanvas>

        <AssumptionsPanel turn={turn} />
        <RefineForm disabled={!!busy} onSubmit={handleRefine} />
      </div>
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Diagram Studio</div>
        <button type="button" onClick={newDiagram} disabled={!!busy}>
          New diagram
        </button>
      </header>

      <main className="layout">
        <aside className="left-panel">
          <PromptPanel
            diagramType={diagramType}
            onTypeChange={handleTypeChange}
            prompt={prompt}
            onPromptChange={setPrompt}
            busy={!!busy}
            onGenerate={handleGenerate}
          />
          <SamplePrompts disabled={!!busy} onUse={handleUseSample} />
          <SessionList sessions={sessions} activeId={sessionId} disabled={!!busy} onOpen={openSession} />
        </aside>

        <section className="canvas-panel" aria-live="polite">
          {error && (
            <div className="banner error" role="alert">
              {error}
            </div>
          )}
          {busy && progressId && <ProgressPanel key={progressId} progressId={progressId} label={busy} />}
          {busy && !progressId && (
            <div className="loading" role="status">
              <span className="spinner" aria-hidden="true" />
              {busy}
            </div>
          )}
          {renderResult()}
        </section>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
