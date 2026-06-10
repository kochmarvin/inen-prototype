# Emotionserkennung in Video-Calls – Prototyp

Begleitender Prototyp zum Position Paper *Emotionserkennung in Video-Calls
mit Künstlicher Intelligenz*. Das System besteht aus vier eigenständig
startbaren Komponenten, die per HTTP kommunizieren.

## Architektur

```
[Desktop App: Python/Tkinter]
        | POST /frame (JPEG, ~1 fps)
        v
[Backend: Node.js + Express]  ---- POST /predict (JPEG) ---->  [ML Service: Python/FastAPI + YOLO]
        ^                                                            (best.pt)
        | GET /status (poll 1.5 s)
        |
[Frontend: React/Vite – Ampel mit Smileys]
```

| Ordner                  | Aufgabe                                                 | Port |
| ----------------------- | ------------------------------------------------------- | ---- |
| [`ml-service/`](ml-service/) | YOLO-Inferenz (FastAPI), lädt `best.pt`                 | 8001 |
| [`backend/`](backend/)       | Express-Proxy, Emotion→Ampel-Mapping, In-Memory-Status | 3000 |
| [`desktop/`](desktop/)       | Screen Capture, sendet Frames an das Backend            | –    |
| [`frontend/`](frontend/)     | React-Ampel, pollt `/status` alle 1,5 s                 | 5173 |

Das trainierte Modell liegt in
[`Facial Emotion Detection/best.pt`](Facial%20Emotion%20Detection/best.pt)
und wird im Setup nach `ml-service/best.pt` kopiert.

## Erkannte Klassen und Ampel-Mapping

Das YOLO-Modell unterscheidet sieben Klassen. Die zentrale Zuordnung lebt in
[`backend/src/emotionMapping.js`](backend/src/emotionMapping.js):

| Emotion             | Ampel |
| ------------------- | ----- |
| `happy`, `surprise` | grün  |
| `neutral`           | gelb  |
| `sad`, `angry`, `fear`, `disgust` | rot |

Zusätzlich liefert das Backend einen `smoothedLight`-Wert, der die häufigste
Ampelfarbe über die letzten fünf Frames repräsentiert, damit die Anzeige
nicht flackert.

## Start mit Docker Compose (empfohlen)

Alle drei serverseitigen Dienste mit einem Befehl bauen und starten:

```bash
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend:  <http://localhost:3000>
- ML Service: <http://localhost:8001> (intern; nur für Debug exponiert)

Stoppen mit `docker compose down`. Beim ersten Build dauert der ML-Service
etwas länger, weil PyTorch/Ultralytics installiert wird (≈ 1.5 GB Image).

Die **Desktop-App läuft NICHT im Container** – sie braucht den echten
Host-Bildschirm. Wie gewohnt starten:

```bash
cd desktop
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py     # postet an http://localhost:3000
```

## Start ohne Docker (manuell)

Vier Terminals – jeweils ein Dienst:

### 1. ML Service

```bash
cd ml-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# best.pt einmalig hineinkopieren:
cp "../Facial Emotion Detection/best.pt" ./best.pt
uvicorn app:app --host 0.0.0.0 --port 8001
```

### 2. Backend

```bash
cd backend
npm install
npm run dev      # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

### 4. Desktop App

```bash
cd desktop
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Im UI „Start" drücken – die Ampel im Browser sollte innerhalb von ein bis
zwei Sekunden reagieren.

## Konfiguration

Alle Komponenten haben sinnvolle Defaults, lassen sich aber per Umgebungs-
variable umlenken (Ports anders belegt, Hosts gewechselt usw.):

| Komponente   | Variable           | Default                   |
| ------------ | ------------------ | ------------------------- |
| ml-service   | `MODEL_PATH`       | `./best.pt`               |
| ml-service   | `MIN_CONFIDENCE`   | `0.25`                    |
| backend      | `PORT`             | `3000`                    |
| backend      | `ML_SERVICE_URL`   | `http://localhost:8001`   |
| backend      | `ML_TIMEOUT_MS`    | `10000`                   |
| frontend     | `VITE_BACKEND_URL` | `http://localhost:3000`   |
| desktop (UI) | Backend-URL Feld   | `http://localhost:3000`   |
| desktop      | `REQUEST_TIMEOUT_S`| `8` lokal, `30` bei `https://` |

## Troubleshooting

- **macOS Screen Recording Permission** – beim ersten Capture-Start fragt
  macOS nach der Berechtigung. Unter *Systemeinstellungen → Datenschutz &
  Sicherheit → Bildschirmaufnahme* freigeben und die Desktop-App neu starten.
- **CORS / Frontend findet Backend nicht** – sicherstellen, dass das Backend
  auf Port 3000 läuft und CORS aktiv ist (Default).
- **`face_found: false` im Backend-Response** – kein Gesicht im aktuellen
  Frame erkannt. Mit dem Mauszeiger das Videofenster des Gesprächspartners
  in den Vordergrund holen oder größer ziehen.
- **Hohe CPU-Last im ML-Service** – Intervall in der Desktop-App auf
  z. B. 2 s hochsetzen oder `MIN_CONFIDENCE` anheben.

## AWS Deployment (Terraform)

Die Cloud-Variante aus dem Position Paper ist unter [`terraform/`](terraform/)
umgesetzt: S3 + CloudFront (Frontend), API Gateway, zwei Lambda-Container
(App-Backend + Emotions-ML).

Kurzablauf:

```bash
cp "Facial Emotion Detection/best.pt" ml-service/best.pt
cd terraform && cp terraform.tfvars.example terraform.tfvars && terraform init
terraform apply -target=module.ecr -target=module.iam
./scripts/build-and-push.sh
terraform apply
./scripts/upload-frontend.sh
```

Details, Warm-up-Hinweis und Desktop-URL: [`terraform/README.md`](terraform/README.md).

- **Browser:** `terraform output cloudfront_url`
- **Desktop-App:** Backend-URL = `terraform output desktop_backend_url` (endet auf `/api`)
- **GitHub:** optional; lokales Deploy reicht. Keine AWS-Keys ins Repo.

### Nur Frontend neu deployen (nach UI-Änderungen)

Kein `terraform apply` nötig — nur bauen und nach S3 hochladen:

```bash
cd terraform
eval "$(aws configure export-credentials --profile default --format env)"   # falls aws login
./scripts/upload-frontend.sh
```

Danach Browser hard-refreshen (oder 1–2 Min. warten bis CloudFront-Invalidation durch ist).

## Hinweis zum Position Paper

Lokal und in AWS bleibt der Datenfluss gleich: Desktop-App → HTTP-API
(Express unter `/api`) → Inferenz (FastAPI/YOLO) → Webanwendung (`/api/status`).
In AWS ist keine persistente Datenbank vorgesehen; der Ampel-Status lebt
kurzzeitig im Speicher der App-Lambda (Provisioned Concurrency = 1).


cp "Facial Emotion Detection/best.pt" ml-service/best.pt
cd terraform && cp terraform.tfvars.example terraform.tfvars && terraform init
terraform apply -target=module.ecr -target=module.iam
./scripts/build-and-push.sh
terraform apply
./scripts/upload-frontend.sh


https://d3tmzx4qjqwpes.cloudfront.net/api