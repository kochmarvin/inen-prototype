# Desktop App – Screen Capture Client

Python Tkinter app that captures the primary screen at a configurable rate
and POSTs each frame as JPEG to the Node.js backend.

## Setup

```bash
cd desktop
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

The UI lets you:

- set the backend URL (default `http://localhost:3000`),
- choose the capture interval (0.5 – 3 s),
- start / stop the capture loop,
- monitor the last detected emotion, confidence, and traffic-light value.

Frames are resized so the longest edge is 960 px and JPEG-encoded at
quality 70 to keep the upload light.

For AWS (`https://…` backend URL), upload timeout defaults to **30 s** (ML
Lambda cold start). Override with `REQUEST_TIMEOUT_S=15 python main.py`.
Local `http://localhost:3000` stays at **8 s**.

A **Debug log** panel in the window (and the same lines in the terminal) shows
capture size, POST URL, HTTP status, latency, and errors. Disable terminal
duplication with `DESKTOP_DEBUG=0 python main.py`.

## macOS notes

### `ModuleNotFoundError: No module named '_tkinter'`

Homebrew’s `python@3.14` (and other `python@3.x` kegs) is often built **without**
Tcl/Tk, so `tkinter` cannot load. Install the matching Tk package and recreate
the virtualenv with that same Python:

```bash
brew install python-tk@3.14
cd desktop
rm -rf .venv
"$(brew --prefix python@3.14)/bin/python3.14" -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

If you use another Python version, match the formula (e.g. `python-tk@3.12`
with `python@3.12`).

### Screen Recording

The first time you start a capture, macOS asks for Screen Recording
permission for your Python/Terminal app. Grant it under
*System Settings → Privacy & Security → Screen Recording* and restart the
app.
