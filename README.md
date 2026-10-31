# Diagram Studio

Generate professional technical diagrams from a prompt. Pick a diagram type (Technical, Logical, Network, RACI or Workflow), describe the system, and the DiagramAgent asks clarifying questions when needed, then renders the diagram. Refine it with follow-up prompts, copy it as PNG, or download it as JPG.

```
diagram-studio/
├── backend/          FastAPI + SQLAlchemy + Amazon Bedrock (DiagramAgent)
│   ├── app/          application code (agent, parsing, routes, LLM client)
│   ├── app/prompts/  DiagramAgent system prompt (plain text, editable without code changes)
│   └── tests/        unit tests for response parsing, the agent and the API
└── frontend/         Next.js (App Router, static export) + Mermaid.js
    ├── app/          single page
    ├── components/   prompt panel, clarification form, canvas, RACI table, history
    └── lib/          API client, export (PNG/JPG/clipboard), RACI SVG, types
```

## How it works

1. `POST /api/v1/sessions` creates a session and sends the diagram type and prompt to Bedrock with the DiagramAgent system prompt.
2. The model replies with JSON, validated with Pydantic:
   - `needs_clarification`: the UI shows the questions as a form. Answers go to `POST /sessions/{id}/messages` with the full history.
   - `diagram`: the UI renders it. Mermaid diagrams render in `securityLevel: "strict"`. RACI matrices render as a styled table.
3. Invalid JSON gets one retry with an instruction to return valid JSON only.
4. After 3 clarification rounds, the next input forces a diagram built from the stated assumptions.
5. If Mermaid fails to render in the browser, the error is sent once to `POST /sessions/{id}/repair`. A second failure is shown to the user.
6. Sessions, messages and diagrams are stored in SQLite.

## API

Base path `/api/v1`. Errors use one shape: `{"error": {"code": "...", "message": "..."}}`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/sessions` | Create a session from `{diagram_type, prompt}`. Returns 201 with a turn. |
| POST | `/sessions/{id}/messages` | Send clarification answers or a refinement: `{content}`. |
| POST | `/sessions/{id}/repair` | Send a Mermaid render error: `{error}`. Allowed once per diagram. |
| GET | `/sessions/{id}` | Session history and the latest turn. |
| GET | `/sessions` | Recent sessions for the history list. |
| GET | `/health` | Liveness and database check. |

Common error codes: `validation_error` (422), `prompt_too_long` (422), `session_not_found` (404), `repair_limit_reached` (409), `no_current_diagram` (409), `llm_timeout` (504), `llm_error` (502), `invalid_llm_response` (502).

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- AWS credentials with `bedrock:InvokeModel` access to an Anthropic Claude model in your region. Locally these come from the standard AWS credential chain (`aws configure` or `AWS_PROFILE`).

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then set BEDROCK_MODEL_ID and AWS_REGION
uvicorn app.main:create_app --factory --reload --port 8000
```

The API is at http://localhost:8000/api/v1 and the interactive docs are at http://localhost:8000/docs.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local         # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

Open http://localhost:3000.

### Tests

```bash
cd backend
pytest
```

The tests use a scripted fake LLM, so they need no AWS credentials. The frontend typecheck and production build run with `npm run typecheck` and `npm run build`.

## Environment variables (backend)

| Variable | Default | Description |
| --- | --- | --- |
| `BEDROCK_MODEL_ID` | (required) | Bedrock model ID, for example an Anthropic Claude model enabled in your account. |
| `AWS_REGION` | `us-east-1` | Region of the Bedrock endpoint. |
| `DATABASE_URL` | `sqlite:///./data/diagram_studio.db` | SQLAlchemy URL. Use a path on persistent storage in production. |
| `LLM_TIMEOUT_SECONDS` | `90` | Read timeout for each model call. |
| `LLM_MAX_TOKENS` | `8192` | Maximum output tokens per call. |
| `LLM_TEMPERATURE` | `0.2` | Sampling temperature. |
| `MAX_PROMPT_CHARS` | `8000` | Maximum length of any prompt or message. |
| `MAX_CLARIFICATION_ROUNDS` | `3` | Clarification rounds before the agent must produce a diagram. |
| `MAX_REPAIR_ATTEMPTS` | `1` | Mermaid repair requests allowed per diagram. |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | JSON list of allowed browser origins. Set to the CloudFront domain in production. |
| `LOG_LEVEL` | `INFO` | Python log level. Logs go to stdout for CloudWatch. |

Frontend (build time): `NEXT_PUBLIC_API_BASE_URL` is the backend API base URL. It is compiled into the static bundle, so rebuild after changing it.

## Deployment (AWS)

Architecture: the frontend is a static export on S3 served through CloudFront. The backend is one container on ECS Fargate or App Runner, with the SQLite file on EFS.

### 1. Backend container

```bash
cd backend
docker build -t diagram-studio-api .
```

Push the image to Amazon ECR, then deploy with these settings:

- **Desired count and max tasks: 1.** SQLite does not support multiple writers across instances.
- **Task role** with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the chosen model ARN. No API keys are needed.
- **Environment variables** from Systems Manager Parameter Store (`BEDROCK_MODEL_ID`, `AWS_REGION`, `CORS_ORIGINS`, and so on). Use the `secrets` block in the task definition for values you want to keep out of the console.
- **EFS volume** mounted at `/data`. The image sets `DATABASE_URL=sqlite:////data/diagram_studio.db`.
- **Logging** through the `awslogs` driver to CloudWatch Logs.
- **Health check** on `GET /api/v1/health`, and a load balancer in front of the service.

### 2. SQLite backups

Create an AWS Backup plan for the EFS file system, or run a scheduled task that copies the database file to S3 using SQLite's online backup (`sqlite3 ... ".backup"`). Do not copy the live file while it is being written. The app uses SQLite's default rollback journal, which works on EFS. Do not switch it to WAL mode on EFS.

### 3. Frontend

```bash
cd frontend
echo "NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1" > .env.production
npm ci
npm run build                      # writes the static site to ./out
aws s3 sync out/ s3://YOUR_BUCKET --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

Set the CloudFront origin to the S3 bucket with Origin Access Control. Allow the CloudFront domain in the backend's `CORS_ORIGINS`.

## Notes and limits

- The model ID is configuration only. Use an Anthropic Claude model that is enabled for your account in the chosen region.
- RACI "Copy source" copies the matrix as JSON, because there is no Mermaid source for a RACI matrix.
- Copy as PNG and the clipboard need a browser with `ClipboardItem` support. The Download button uses the Save As dialog where `showSaveFilePicker` exists (Chromium) and a normal download elsewhere.
- The Next.js build is pinned to the 14.2 line, which has security patches. The `mermaid` package is pinned to 11.4.1.
