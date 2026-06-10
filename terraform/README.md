# AWS Deployment (Terraform, lokal)

Dieses Verzeichnis provisioniert die serverlose Architektur aus dem Position Paper:

- **S3 + CloudFront** — statisches React-Frontend
- **API Gateway (HTTP API)** — `/api/*` und `/emotion/*`
- **Lambda (Container)** — App-Backend (Express) und Emotions-ML (FastAPI/YOLO)

## Voraussetzungen

1. AWS-Account und IAM-Berechtigungen (Lambda, API Gateway, S3, CloudFront, ECR, IAM).
2. Lokal installiert: [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5, AWS CLI v2, Docker.
3. AWS-Anmeldung (eine der Varianten):
   - **`aws login`** (neu, Browser-Login) — siehe Abschnitt *Terraform + aws login* unten
   - **`aws configure`** (klassische Access Keys)
   - **`aws sso login`** (wenn IAM Identity Center eingerichtet ist)

## Terraform + `aws login`

`aws login` reicht für die **AWS CLI**, aber der Terraform AWS-Provider erkennt diese
Session oft **noch nicht** („No valid credential sources found“). Das ist bekannt;
die CLI speichert die Session anders als Terraform sie erwartet.

**Schnelllösung** (nach `aws login`, im selben Terminal):

```bash
eval "$(aws configure export-credentials --profile default --format env)"
aws sts get-caller-identity   # muss funktionieren
terraform apply -target=module.ecr -target=module.iam
```

Oder das Hilfsskript (exportiert Credentials und führt Terraform aus):

```bash
./scripts/terraform-with-login.sh apply -target=module.ecr -target=module.iam
```

**Dauerhaft** (optional in `~/.aws/config`): separates Profil nur für Terraform:

```ini
[profile ineni-terraform]
credential_process = aws configure export-credentials --profile default --format process
region = eu-central-1
```

```bash
export AWS_PROFILE=ineni-terraform
terraform apply
```

## Modell vorbereiten

```bash
cp "Facial Emotion Detection/best.pt" ml-service/best.pt
```

`best.pt` wird ins ML-Lambda-Image gebaut (~5 MB). In öffentlichen Repos das Modell nicht committen.

## Deploy-Reihenfolge (zweistufig)

Lambda-Images müssen in ECR liegen, bevor die Funktionen starten.

### 1. Konfiguration

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# project_name und aws_region bei Bedarf anpassen
terraform init
```

### 2. Infrastruktur + ECR

```bash
terraform apply -target=module.ecr -target=module.iam
```

Oder ein vollständiges `terraform apply` — schlägt fehl, bis Images gepusht sind; das ist erwartbar.

### 3. Docker-Images bauen und pushen

```bash
./scripts/build-and-push.sh
```

Baut `linux/amd64`-Images aus [`backend/Dockerfile.lambda`](../backend/Dockerfile.lambda) und [`ml-service/Dockerfile.lambda`](../ml-service/Dockerfile.lambda).

### 4. Lambdas und Rest deployen

```bash
terraform apply
```

### 5. Frontend hochladen

```bash
./scripts/upload-frontend.sh
```

### 6. Testen

```bash
terraform output cloudfront_url
terraform output desktop_backend_url
```

- Browser: `cloudfront_url` öffnen → Ampel wartet auf Frames.
- Desktop-App: Backend-URL = `desktop_backend_url` (z. B. `https://dxxx.cloudfront.net/api`).
- Erster Frame kann wegen ML-Cold-Start **10–30 s** dauern (API-Timeout 29 s). Vor einer Demo einmal `/emotion/predict` über API Gateway warmfahren oder einen Test-Frame senden.

## Outputs

| Output | Bedeutung |
|--------|-----------|
| `cloudfront_url` | Öffentliche HTTPS-URL der Web-App |
| `desktop_backend_url` | URL für das Desktop-UI-Feld |
| `api_endpoint` | Direkte API-Gateway-URL (ohne CloudFront) |
| `ecr_*_repository_url` | ECR-Repos für Image-Updates |

## Architektur (Kurz)

```
Browser ──► CloudFront ──► S3 (SPA)
              │
              ├── /api/* ──► API Gateway ──► App-Lambda (Express, /api/*)
              │                              │
              │                              └── invoke ──► Emotion-Lambda (YOLO)
              └── /emotion/* ──► API Gateway ──► Emotion-Lambda (optional, Debug)

Desktop ──► CloudFront /api/frame ──► App-Lambda
```

Die App-Lambda kann optional **Provisioned Concurrency = 1** nutzen (`app_provisioned_concurrency` in
`terraform.tfvars`), damit der In-Memory-Status für `GET /api/status` stabil bleibt. Standard ist `0`
(neue/kleine AWS-Accounts haben oft zu wenig unreserved Concurrency).

## Troubleshooting

### `/api` → Access Denied, `/api/status` → Internal Server Error

- **`/api` ohne Pfad:** CloudFront-Muster `/api/*` trifft `/api` nicht — Anfrage landete auf S3 (privat → Access Denied). Behoben durch extra Cache-Behavior `/api`.
- **500 Internal Server Error:** API Gateway rief den Lambda-Alias `live` auf, die Invoke-Berechtigung galt aber nur für die Funktion ohne Alias. Ohne Provisioned Concurrency wird jetzt `$LATEST` statt Alias genutzt.

Nach Code-Fix:

```bash
./scripts/build-and-push-app.sh   # nur App-Backend (schnell, kein ML-Image)
# oder: ./scripts/build-and-push.sh app
terraform apply
```

Test direkt (ohne CloudFront):

```bash
curl "$(terraform output -raw api_endpoint)/api/status"
```

### Lambda: „UnreservedConcurrentExecution below its minimum value of [10]“

Dein Account hat nicht genug freie Lambda-Concurrency für Provisioned Concurrency. In
`terraform.tfvars`:

```hcl
app_provisioned_concurrency = 0
```

Dann `terraform apply` erneut. Die App funktioniert trotzdem; `/api/status` kann bei mehreren
parallelen Aufrufen/Cold Starts kurz leer wirken. Später bei Quota-Erhöhung in der AWS Console
(Lambda → Limits) auf `1` setzen.

### Lambda: „image manifest … is not supported“

| Komponente | Variable | AWS |
|------------|----------|-----|
| App-Lambda | `EMOTION_LAMBDA_NAME` | von Terraform gesetzt |
| App-Lambda | `ML_TIMEOUT_MS` | `15000` |
| Emotion-Lambda | `MODEL_PATH` | `/var/task/best.pt` |
| Frontend-Build | `VITE_BACKEND_URL` | leer (same-origin `/api`) |

Lokal (Docker Compose) bleibt `ML_SERVICE_URL=http://ml-service:8001` aktiv; die App-Lambda-Invoke-Logik greift nur, wenn `EMOTION_LAMBDA_NAME` gesetzt ist.

## Troubleshooting

### Lambda: „image manifest … is not supported“

Docker Desktop (v. a. auf dem Mac) pusht manchmal OCI-Manifeste mit Attestations,
die **AWS Lambda nicht akzeptiert**. `./scripts/build-and-push.sh` nutzt deshalb
`docker buildx build` mit `--provenance=false --sbom=false`.

Nach dem Fix Images neu pushen und erneut applyen:

```bash
./scripts/build-and-push.sh
terraform apply
./scripts/upload-frontend.sh
```

`upload-frontend.sh` erst **nach** erfolgreichem `terraform apply` — sonst fehlen
Lambdas/API (nur statische Seite ohne Backend).

## Aufräumen

```bash
terraform destroy
```

Leert ECR-Repos nur, wenn `force_delete` greift und keine Images mehr blockieren.

## GitHub

Nicht nötig für das Deployment. Optional später: GitHub Actions mit `aws configure` über OIDC, dann dieselben Skripte in CI ausführen.

**Nicht committen:** `terraform.tfstate`, AWS-Keys, ggf. `best.pt` bei öffentlichem Repo.
