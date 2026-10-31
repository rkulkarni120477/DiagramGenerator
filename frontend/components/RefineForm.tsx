"use client";

import { useState, type FormEvent } from "react";
import { MAX_PROMPT_CHARS } from "@/lib/prompt-template";

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function RefineForm({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  };

  return (
    <form className="card refine" onSubmit={submit}>
      <label htmlFor="refine-input">Refine this diagram</label>
      <div className="row">
        <input
          id="refine-input"
          type="text"
          maxLength={MAX_PROMPT_CHARS}
          placeholder="e.g. add a cache layer between the API and the database"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="primary" disabled={disabled || !value.trim()}>
          Refine
        </button>
      </div>
    </form>
  );
}
