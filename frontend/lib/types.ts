export type DiagramType = "technical" | "layered" | "logical" | "network" | "raci" | "workflow";

export const DIAGRAM_TYPES: { value: DiagramType; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "layered", label: "Layered" },
  { value: "logical", label: "Logical" },
  { value: "network", label: "Network" },
  { value: "raci", label: "RACI" },
  { value: "workflow", label: "Workflow" },
];

export function diagramTypeLabel(type: DiagramType): string {
  return DIAGRAM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export type RaciCode = "R" | "A" | "C" | "I" | "A/R";

export interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[] | null;
}

export interface ClarificationTurn {
  status: "needs_clarification";
  summary: string;
  questions: ClarificationQuestion[];
}

interface DiagramBase {
  status: "diagram";
  title: string;
  assumptions: string[];
  constraints_applied: string[];
  notes?: string | null;
}

export interface MermaidDiagram extends DiagramBase {
  diagram_type: Exclude<DiagramType, "raci" | "layered">;
  format: "mermaid";
  mermaid: string;
}

export interface RaciTask {
  task: string;
  assignments: Partial<Record<string, RaciCode>>;
}

export interface RaciDiagram extends DiagramBase {
  diagram_type: "raci";
  format: "raci_matrix";
  roles: string[];
  tasks: RaciTask[];
}

export interface LayerComponent {
  name: string;
  kind: "component" | "database";
}

export interface Layer {
  name: string;
  closed: boolean;
  components: LayerComponent[];
}

export interface CrossCuttingConcern {
  name: string;
  components: LayerComponent[];
}

export interface HostingInfo {
  provider: string;
  region?: string | null;
}

export interface LayeredDiagram extends DiagramBase {
  diagram_type: "layered";
  format: "layered_stack";
  entry_point: string;
  hosting?: HostingInfo | null;
  layers: Layer[];
  cross_cutting: CrossCuttingConcern[];
}

export type DiagramTurn = MermaidDiagram | RaciDiagram | LayeredDiagram;
export type AgentTurn = ClarificationTurn | DiagramTurn;

export interface TurnResponse {
  session_id: string;
  diagram_id: number | null;
  turn: AgentTurn;
}

export interface SessionSummary {
  id: string;
  title: string;
  diagram_type: DiagramType;
  updated_at: string;
}

export interface MessageOut {
  id: number;
  role: "user" | "assistant";
  kind: string;
  content: string;
  created_at: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  diagram_type: DiagramType;
  created_at: string;
  updated_at: string;
  messages: MessageOut[];
  latest_turn: AgentTurn | null;
  latest_diagram_id: number | null;
}

export interface ProgressEvent {
  step: string;
  detail: string;
  percent: number;
  at: string;
}

export interface ProgressSnapshot {
  id: string;
  done: boolean;
  failed: boolean;
  percent: number;
  events: ProgressEvent[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
