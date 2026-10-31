"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ProgressSnapshot } from "@/lib/types";

const POLL_INTERVAL_MS = 600;

interface Props {
  progressId: string;
  label: string;
}

export function ProgressPanel({ progressId, label }: Props) {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await api.getProgress(progressId);
        if (!cancelled) setSnapshot(next);
      } catch {
        // A missed poll is harmless; the next one will try again.
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [progressId]);

  const percent = snapshot?.percent ?? 0;
  const events = snapshot?.events ?? [];

  return (
    <section className="progress-panel" role="status" aria-live="polite" aria-label="Generation progress">
      <div className="progress-title">
        <span className="spinner" aria-hidden="true" />
        <span>{label}</span>
        <span className="progress-percent">{percent}%</span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>

      {events.length > 0 && (
        <ol className="progress-steps">
          {events.map((event, index) => (
            <li key={index} className={event.step === "Failed" ? "failed" : ""}>
              <span className="progress-time">{new Date(event.at).toLocaleTimeString()}</span>
              <span className="progress-step">{event.step}</span>
              {event.detail && <span className="progress-detail">{event.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
