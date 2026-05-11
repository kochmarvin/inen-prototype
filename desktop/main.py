"""Desktop screen-capture client.

Captures the primary screen at a configurable interval, JPEG-encodes the
frame and POSTs it to the Node.js backend's /frame endpoint. A small
Tkinter GUI lets the user pick the backend URL, the capture interval, and
start/stop the capture loop.
"""

from __future__ import annotations

import io
import queue
import sys
import threading
import time
from typing import Optional

try:
    import tkinter as tk
    from tkinter import ttk
except ModuleNotFoundError as exc:
    # Homebrew's python@3.x is often built without Tcl/Tk; _tkinter is missing.
    if getattr(exc, "name", None) in ("_tkinter", "tkinter"):
        print(
            "Tkinter is not available (missing _tkinter).\n\n"
            "On macOS with Homebrew Python 3.14, install the Tk bindings and "
            "recreate the venv:\n"
            "  brew install python-tk@3.14\n"
            "  cd desktop && rm -rf .venv\n"
            "  $(brew --prefix python@3.14)/bin/python3.14 -m venv .venv\n"
            "  source .venv/bin/activate && pip install -r requirements.txt\n",
            file=sys.stderr,
        )
        sys.exit(1)
    raise

import mss
import requests
from PIL import Image

DEFAULT_BACKEND_URL = "http://localhost:3000"
DEFAULT_INTERVAL_S = 1.0
JPEG_QUALITY = 70
# YOLO was trained on 640x640 inputs – downscaling here saves bandwidth and
# inference time without hurting accuracy in this scenario.
MAX_DIMENSION = 960
REQUEST_TIMEOUT_S = 8.0


def capture_jpeg(sct: mss.base.MSSBase) -> bytes:
    """Grab the primary monitor and return a JPEG byte string."""
    monitor = sct.monitors[1]  # index 1 = primary monitor; 0 = "all monitors"
    shot = sct.grab(monitor)
    img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    width, height = img.size
    longest = max(width, height)
    if longest > MAX_DIMENSION:
        scale = MAX_DIMENSION / longest
        img = img.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


class CaptureWorker(threading.Thread):
    """Background thread that captures and uploads frames at a fixed cadence."""

    def __init__(
        self,
        backend_url: str,
        interval_s: float,
        status_queue: "queue.Queue[dict]",
        stop_event: threading.Event,
    ) -> None:
        super().__init__(daemon=True)
        self.backend_url = backend_url.rstrip("/")
        self.interval_s = max(0.1, interval_s)
        self.status_queue = status_queue
        self.stop_event = stop_event

    def run(self) -> None:
        try:
            with mss.mss() as sct, requests.Session() as session:
                while not self.stop_event.is_set():
                    cycle_start = time.monotonic()
                    try:
                        jpeg = capture_jpeg(sct)
                    except Exception as exc:
                        self._emit({"kind": "error", "message": f"capture failed: {exc}"})
                        if self.stop_event.wait(self.interval_s):
                            break
                        continue

                    try:
                        response = session.post(
                            f"{self.backend_url}/frame",
                            files={"image": ("frame.jpg", jpeg, "image/jpeg")},
                            timeout=REQUEST_TIMEOUT_S,
                        )
                        response.raise_for_status()
                        payload = response.json()
                        self._emit({"kind": "ok", "payload": payload, "bytes": len(jpeg)})
                    except requests.RequestException as exc:
                        self._emit({"kind": "error", "message": f"upload failed: {exc}"})
                    except ValueError as exc:
                        self._emit({"kind": "error", "message": f"bad response: {exc}"})

                    elapsed = time.monotonic() - cycle_start
                    sleep_for = max(0.0, self.interval_s - elapsed)
                    if self.stop_event.wait(sleep_for):
                        break
        finally:
            self._emit({"kind": "stopped"})

    def _emit(self, event: dict) -> None:
        try:
            self.status_queue.put_nowait(event)
        except queue.Full:
            pass


class DesktopApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Emotion Capture Client")
        self.root.geometry("480x320")
        self.root.resizable(False, False)

        self.backend_var = tk.StringVar(value=DEFAULT_BACKEND_URL)
        self.interval_var = tk.DoubleVar(value=DEFAULT_INTERVAL_S)
        self.status_var = tk.StringVar(value="idle")
        self.last_var = tk.StringVar(value="-")
        self.counter_var = tk.StringVar(value="0 frames sent")

        self.frame_count = 0
        self.status_queue: queue.Queue = queue.Queue(maxsize=64)
        self.stop_event: Optional[threading.Event] = None
        self.worker: Optional[CaptureWorker] = None

        self._build_ui()
        self.root.after(100, self._drain_queue)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        pad = {"padx": 12, "pady": 6}

        ttk.Label(self.root, text="Backend URL").grid(row=0, column=0, sticky="w", **pad)
        ttk.Entry(self.root, textvariable=self.backend_var, width=42).grid(
            row=0, column=1, columnspan=2, sticky="we", **pad
        )

        ttk.Label(self.root, text="Interval (seconds)").grid(row=1, column=0, sticky="w", **pad)
        ttk.Scale(
            self.root,
            from_=0.5,
            to=3.0,
            orient="horizontal",
            variable=self.interval_var,
            command=lambda _v: self.interval_value_label.configure(
                text=f"{self.interval_var.get():.1f} s"
            ),
        ).grid(row=1, column=1, sticky="we", **pad)
        self.interval_value_label = ttk.Label(self.root, text=f"{DEFAULT_INTERVAL_S:.1f} s")
        self.interval_value_label.grid(row=1, column=2, sticky="w", **pad)

        self.start_btn = ttk.Button(self.root, text="Start", command=self._start)
        self.start_btn.grid(row=2, column=0, sticky="we", **pad)
        self.stop_btn = ttk.Button(self.root, text="Stop", command=self._stop, state="disabled")
        self.stop_btn.grid(row=2, column=1, sticky="we", **pad)

        ttk.Separator(self.root, orient="horizontal").grid(
            row=3, column=0, columnspan=3, sticky="we", padx=12, pady=4
        )

        ttk.Label(self.root, text="Status").grid(row=4, column=0, sticky="w", **pad)
        ttk.Label(self.root, textvariable=self.status_var, foreground="#333").grid(
            row=4, column=1, columnspan=2, sticky="w", **pad
        )

        ttk.Label(self.root, text="Last result").grid(row=5, column=0, sticky="w", **pad)
        ttk.Label(self.root, textvariable=self.last_var).grid(
            row=5, column=1, columnspan=2, sticky="w", **pad
        )

        ttk.Label(self.root, text="Sent").grid(row=6, column=0, sticky="w", **pad)
        ttk.Label(self.root, textvariable=self.counter_var).grid(
            row=6, column=1, columnspan=2, sticky="w", **pad
        )

        self.root.columnconfigure(1, weight=1)

    def _start(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        backend_url = self.backend_var.get().strip()
        if not backend_url:
            self.status_var.set("backend URL required")
            return
        self.stop_event = threading.Event()
        self.worker = CaptureWorker(
            backend_url=backend_url,
            interval_s=float(self.interval_var.get()),
            status_queue=self.status_queue,
            stop_event=self.stop_event,
        )
        self.worker.start()
        self.status_var.set("running")
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")

    def _stop(self) -> None:
        if self.stop_event is not None:
            self.stop_event.set()
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.status_var.set("stopping...")

    def _on_close(self) -> None:
        self._stop()
        self.root.after(150, self.root.destroy)

    def _drain_queue(self) -> None:
        try:
            while True:
                event = self.status_queue.get_nowait()
                self._handle_event(event)
        except queue.Empty:
            pass
        self.root.after(100, self._drain_queue)

    def _handle_event(self, event: dict) -> None:
        kind = event.get("kind")
        if kind == "ok":
            payload = event.get("payload") or {}
            self.frame_count += 1
            self.counter_var.set(f"{self.frame_count} frames sent ({event.get('bytes', 0) // 1024} kB last)")
            emotion = payload.get("emotion") or "no face"
            confidence = payload.get("confidence") or 0.0
            light = payload.get("smoothedLight") or payload.get("light") or "-"
            self.last_var.set(f"{emotion} ({confidence:.0%}) -> {light}")
            self.status_var.set("running")
        elif kind == "error":
            self.status_var.set(f"error: {event.get('message', 'unknown')}")
        elif kind == "stopped":
            self.status_var.set("idle")
            self.start_btn.configure(state="normal")
            self.stop_btn.configure(state="disabled")


def main() -> None:
    root = tk.Tk()
    DesktopApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
