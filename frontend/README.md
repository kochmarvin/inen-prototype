# Frontend – Traffic-Light React App

Vite + React + TypeScript app that polls the backend's `/status` endpoint
every 500 ms and shows the current mood as a three-step traffic light
(positive / neutral / negative).

## Setup

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev
```

By default the app talks to `http://localhost:3000`. Override per session:

```bash
VITE_BACKEND_URL=http://192.168.1.5:3000 npm run dev
```

Open <http://localhost:5173>.
