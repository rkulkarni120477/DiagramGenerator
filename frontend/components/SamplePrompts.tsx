import { SAMPLE_PROMPTS, type SamplePrompt } from "@/lib/prompt-template";
import { DIAGRAM_TYPES, type DiagramType } from "@/lib/types";

interface Props {
  disabled: boolean;
  onUse: (type: DiagramType, sample: SamplePrompt) => void;
}

export function SamplePrompts({ disabled, onUse }: Props) {
  return (
    <section className="card" aria-labelledby="samples-heading">
      <h2 id="samples-heading">Sample prompts</h2>
      <p className="muted small">Select a sample to load it into the editor with its diagram type.</p>

      {DIAGRAM_TYPES.map((type) => (
        <div key={type.value} className="sample-group">
          <h3>{type.label}</h3>
          <ul className="sample-list">
            {SAMPLE_PROMPTS[type.value].map((sample) => (
              <li key={sample.title}>
                <button
                  type="button"
                  className="sample-item"
                  disabled={disabled}
                  onClick={() => onUse(type.value, sample)}
                >
                  <span className="sample-title">{sample.title}</span>
                  <span className="muted small">{sample.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
