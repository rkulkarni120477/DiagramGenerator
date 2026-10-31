"""Canned DiagramAgent responses shared by the tests."""

import json

MERMAID_DIAGRAM = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "technical",
        "title": "Order service",
        "format": "mermaid",
        "mermaid": 'flowchart TB\n  user["User"] -->|HTTPS REST| api["FastAPI service"]',
        "assumptions": ["Hosted on AWS"],
        "constraints_applied": ["Single instance"],
        "notes": "",
    }
)

MERMAID_REFINED = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "technical",
        "title": "Order service with cache",
        "format": "mermaid",
        "mermaid": 'flowchart TB\n  user["User"] -->|HTTPS REST| api["FastAPI service"]\n  api -->|Cache reads| cache["Redis cache"]',
        "assumptions": ["Hosted on AWS"],
        "constraints_applied": [],
        "notes": None,
    }
)

CLARIFICATION = json.dumps(
    {
        "status": "needs_clarification",
        "summary": "Need the expected user base.",
        "questions": [
            {"id": "q1", "question": "How many users?", "options": ["Under 1k", "1k to 100k", "Over 100k"]}
        ],
    }
)

RACI_DIAGRAM = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "raci",
        "title": "Release process",
        "format": "raci_matrix",
        "roles": ["Product Owner", "Architect", "DevOps"],
        "tasks": [
            {
                "task": "Define architecture",
                "assignments": {"Product Owner": "C", "Architect": "A/R", "DevOps": "C"},
            },
            {
                "task": "Deploy release",
                "assignments": {"Product Owner": "I", "Architect": "R", "DevOps": "A"},
            },
        ],
        "assumptions": ["Single product team"],
        "constraints_applied": [],
        "notes": None,
    }
)

LAYERED_DIAGRAM = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "layered",
        "title": "Web application layers",
        "format": "layered_stack",
        "entry_point": "Request",
        "layers": [
            {
                "name": "Presentation Layer",
                "closed": True,
                "components": [{"name": "Web UI"}, {"name": "Admin UI"}],
            },
            {
                "name": "Business Layer",
                "closed": True,
                "components": [{"name": "Order service"}, {"name": "Pricing service"}],
            },
            {
                "name": "Database Layer",
                "closed": True,
                "components": [{"name": "Orders DB", "kind": "database"}],
            },
        ],
        "cross_cutting": [{"name": "Security", "components": [{"name": "Auth"}]}],
        "assumptions": ["Single region"],
        "constraints_applied": [],
        "notes": None,
    }
)

RACI_TWO_ACCOUNTABLE = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "raci",
        "title": "Bad matrix",
        "format": "raci_matrix",
        "roles": ["Product Owner", "Architect"],
        "tasks": [{"task": "Plan", "assignments": {"Product Owner": "A", "Architect": "A"}}],
    }
)

RACI_NO_RESPONSIBLE = json.dumps(
    {
        "status": "diagram",
        "diagram_type": "raci",
        "title": "Bad matrix",
        "format": "raci_matrix",
        "roles": ["Product Owner", "Architect"],
        "tasks": [{"task": "Plan", "assignments": {"Product Owner": "A", "Architect": "C"}}],
    }
)
