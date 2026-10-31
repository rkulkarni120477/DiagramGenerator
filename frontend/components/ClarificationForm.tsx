"use client";

import { useState, type FormEvent } from "react";
import type { ClarificationTurn } from "@/lib/types";

interface Answer {
  choice: string;
  text: string;
}

const EMPTY_ANSWER: Answer = { choice: "", text: "" };

interface Props {
  turn: ClarificationTurn;
  disabled: boolean;
  onSubmit: (answers: string) => void;
}

export function ClarificationForm({ turn, disabled, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  // A typed answer takes priority over a selected option.
  const resolve = (id: string): string => {
    const answer = answers[id];
    return answer?.text.trim() || answer?.choice || "";
  };

  const update = (id: string, patch: Partial<Answer>) =>
    setAnswers((previous) => ({
      ...previous,
      [id]: { ...EMPTY_ANSWER, ...previous[id], ...patch },
    }));

  const complete = turn.questions.every((q) => resolve(q.id).length > 0);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complete || disabled) return;
    const body = turn.questions
      .map((q, index) => `${index + 1}. ${q.question}\n   Answer: ${resolve(q.id)}`)
      .join("\n\n");
    onSubmit(`Answers to your clarifying questions:\n\n${body}`);
  };

  return (
    <form className="card clarify" onSubmit={submit}>
      <h2>A few questions first</h2>
      <p className="muted">{turn.summary}</p>

      {turn.questions.map((question, index) => (
        <fieldset key={question.id} className="question">
          <legend>
            {index + 1}. {question.question}
          </legend>

          {question.options && question.options.length > 0 && (
            <div className="options">
              {question.options.map((option) => {
                const selected = answers[question.id]?.choice === option && !answers[question.id]?.text;
                return (
                  <button
                    type="button"
                    key={option}
                    className={`chip ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => update(question.id, { choice: option, text: "" })}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          <input
            type="text"
            aria-label={`Your own answer to: ${question.question}`}
            placeholder="Or type your own answer"
            value={answers[question.id]?.text ?? ""}
            onChange={(event) => update(question.id, { text: event.target.value, choice: "" })}
          />
        </fieldset>
      ))}

      <button type="submit" className="primary" disabled={!complete || disabled}>
        Submit answers
      </button>
    </form>
  );
}
