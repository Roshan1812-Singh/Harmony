# Harmony — Deployment Guide

Three reference deployments. Pick one.

---

## A. AWS (production, recommended)

```
Route53 ─▶ CloudFront ─▶ ALB ─▶ ECS Fargate (api task)
   │                              │
   │                              ├─▶ RDS Postgres (Multi-AZ, with read replica)
   │                              ├─▶ ElastiCache Redis (cluster mode)
   │                              ├─▶ OpenSearch (3 master + 2 data)
   │                              └─▶ S3 (private buckets) ─▶ CloudFront (signed URLs)
   │
   └─▶ Vercel (Next.js frontend)
```

### 1. Provision

We ship Terraform in `infra/terraform/` (skeleton). Or click-ops:

| AWS resource | Settings |
|---|---|
| VPC | 2 public + 2 private subnets across 2 AZs |
| RDS | `db.t4g.medium`, Postgres 16, multi-AZ, 100 GB gp3, automated backups 7d |
| ElastiCache | Redis 7.1, `cache.t4g.small`, encryption-at-rest + in-transit |
| OpenSearch | Optional v1; `t3.small.search` × 1 dev, 3 nodes prod |
| S3 | 3 buckets: `harmony-raw` (private), `harmony-stream` (private), `harmony-public-art` (public-read via CloudFront only) |
| CloudFront | Distribution for `harmony-stream` (signed URLs), TTL `max-age=7d` |
| ECR | `harmony/api` |
| ECS | Fargate cluster `harmony`, service `api` (2 tasks min, autoscale to 10 on CPU>60% or ALB p95>500ms) |
| ALB | HTTPS 443 → target group on 4000 |
| ACM | Cert for `api.harmony.example` |
| SES | Verified domain for transactional email |
| Secrets Manager | `harmony/api/*` for all secrets |

### 2. Push API image

```bash
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com

docker build -f infra/docker/api.Dockerfile -t harmony/api:$(git rev-parse --short HEAD) .
docker tag harmony/api:$(git rev-parse --short HEAD) $ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/harmony/api:latest
docker push $ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/harmony/api:latest

aws ecs update-service --cluster harmony --service api --force-new-deployment
```

### 3. First-time DB migrate

```bash
aws ecs run-task --cluster harmony --task-definition harmony-api-migrate
# task definition runs: npx prisma migrate deploy && node dist/scripts/seed.js
```

### 4. CloudFront signed URL key

```bash
openssl genrsa -out cf-private.pem 2048
openssl rsa -in cf-private.pem -pubout > cf-public.pem
# Upload public key to CloudFront → create key group → attach to distribution
# Put private key in Secrets Manager under harmony/api/CLOUDFRONT_PRIVATE_KEY_PEM
```

### 5. Frontend on Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_API_URL production         # https://api.harmony.example/api/v1
vercel env add NEXTAUTH_URL production                # https://harmony.example
vercel --prod
```

---

## B. Render + Vercel (cheap, single click-ish)

- **Frontend** → Vercel (free tier covers a hobby instance).
- **API** → Render Web Service from `infra/docker/api.Dockerfile`.
- **Postgres** → Render Managed Postgres (auto-backup).
- **Redis** → Render Managed Redis.
- **Search** → start without ES; the API auto-falls-back to Postgres FTS.
- **S3** → Backblaze B2 (S3-compatible, ~80% cheaper). Set `S3_ENDPOINT` env var.

`render.yaml` is committed at the repo root.

---

## C. Railway

Identical to Render. `railway.json` provisions Postgres + Redis + the API. Add S3-compatible storage via env.

---

## D. Self-hosted (Kubernetes)

`infra/k8s/` has manifests:

```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.example.yaml     (use sealed-secrets or external-secrets in real life)
├── postgres.yaml
├── redis.yaml
├── elasticsearch.yaml
├── api-deployment.yaml      replicas: 2, hpa min:2 max:10
├── api-service.yaml
├── web-deployment.yaml
├── web-service.yaml
├── transcoder-deployment.yaml
├── ingress.yaml             nginx-ingress + cert-manager
├── prometheus.yaml
└── grafana.yaml
```

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/         # apply all
kubectl -n harmony get pods -w
```

---

## E. Local dev

```bash
docker compose up -d                          # postgres, redis, es, minio, mailhog
pnpm install
pnpm --filter @harmony/api db:migrate
pnpm --filter @harmony/api db:seed
pnpm dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/docs |
| MinIO console | http://localhost:9001 (minioadmin/minioadmin) |
| Mailhog | http://localhost:8025 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin/admin) |

---

## Observability

- Prometheus scrapes `/metrics` on api pods every 15s.
- Pino JSON logs → stdout → CloudWatch / Loki.
- Sentry DSN injected via env on both `web` and `api`.
- Grafana dashboards in `infra/grafana/dashboards/` (auto-provisioned).

## Health checks

| Path | Purpose |
|---|---|
| `GET /healthz` | Liveness — process is up |
| `GET /readyz`  | Readiness — DB + Redis pings, returns 503 until healthy |
| `GET /metrics` | Prometheus scrape (protected by IP allowlist) |

## Rolling deploys

ECS / K8s rolling update with `maxSurge=1, maxUnavailable=0`. The API drains in-flight requests on `SIGTERM` (we register an `app.enableShutdownHooks()` + 10s grace).

## Backups / DR

- RDS daily snapshots, 7d retention; PITR enabled.
- S3 versioning on `harmony-raw` (originals are irreplaceable).
- Documented restore drills: `docs/RUNBOOK_RESTORE.md` (TBD).
