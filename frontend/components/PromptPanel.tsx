import { DIAGRAM_TYPES, type DiagramType } from "@/lib/types";
import { MAX_PROMPT_CHARS } from "@/lib/prompt-template";

interface Props {
  diagramType: DiagramType;
  onTypeChange: (type: DiagramType) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  busy: boolean;
  onGenerate: () => void;
}

export function PromptPanel({ diagramType, onTypeChange, prompt, onPromptChange, busy, onGenerate }: Props) {
  const length = prompt.length;
  const tooLong = length > MAX_PROMPT_CHARS;

  return (
    <section className="card prompt-panel" aria-labelledby="prompt-heading">
      <h2 id="prompt-heading">Describe your diagram</h2>

      <div className="field">
        <label htmlFor="diagram-type">Diagram type</label>
        <select id="diagram-type" value={diagramType} onChange={(e) => onTypeChange(e.target.value as DiagramType)}>
          {DIAGRAM_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          rows={18}
          spellCheck={false}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <div className={`counter ${tooLong ? "over" : ""}`}>
          {length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()} characters
        </div>
      </div>

      <button
        type="button"
        className="primary wide"
        onClick={onGenerate}
        disabled={busy || !prompt.trim() || tooLong}
      >
        {busy ? "Generating…" : "Generate"}
      </button>
    </section>
  );
}
