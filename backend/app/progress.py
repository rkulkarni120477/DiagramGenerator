"""In-memory progress tracking for in-flight generation requests.

Each request can carry an X-Progress-Id header. The agent records steps against that id,
and the frontend polls GET /api/v1/progress/{id}. State lives in this process, which is
fine for the single-instance deployment this app targets.
"""

import threading
import time
from datetime import datetime, timezone

MAX_TRACKED_OPERATIONS = 500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _Operation:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.done = False
        self.failed = False
        self.touched = time.time()


class ProgressStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._operations: dict[str, _Operation] = {}

    def start(self, op_id: str) -> "ProgressReporter":
        with self._lock:
            if len(self._operations) >= MAX_TRACKED_OPERATIONS:
                oldest = min(self._operations, key=lambda key: self._operations[key].touched)
                del self._operations[oldest]
            self._operations[op_id] = _Operation()
        return ProgressReporter(self, op_id)

    def record(self, op_id: str, event: dict, done: bool = False, failed: bool = False) -> None:
        with self._lock:
            operation = self._operations.get(op_id)
            if operation is None:
                return
            operation.events.append(event)
            operation.done = operation.done or done
            operation.failed = operation.failed or failed
            operation.touched = time.time()

    def snapshot(self, op_id: str) -> dict:
        with self._lock:
            operation = self._operations.get(op_id)
            if operation is None:
                return {"events": [], "done": False, "failed": False}
            return {"events": list(operation.events), "done": operation.done, "failed": operation.failed}


class ProgressReporter:
    """Reports steps for one operation. With no store it does nothing, which keeps tests simple."""

    def __init__(self, store: ProgressStore | None, op_id: str | None) -> None:
        self._store = store
        self._op_id = op_id
        self._percent = 0

    def step(self, step: str, percent: int, detail: str = "") -> None:
        self._percent = percent
        if self._store is not None:
            self._store.record(self._op_id, {"step": step, "detail": detail, "percent": percent, "at": _now()})

    def finish(self) -> None:
        if self._store is not None:
            self._store.record(
                self._op_id,
                {"step": "Diagram ready", "detail": "", "percent": 100, "at": _now()},
                done=True,
            )

    def fail(self, message: str) -> None:
        if self._store is not None:
            self._store.record(
                self._op_id,
                {"step": "Failed", "detail": message, "percent": self._percent, "at": _now()},
                done=True,
                failed=True,
            )


NULL_PROGRESS = ProgressReporter(None, None)
