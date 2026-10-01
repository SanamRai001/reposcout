# RepoScout — Oracle Always Free production deployment

**State:** Deployment files are prepared in the repository, not evidence that an OCI account, VM, domain, or hosted PostgreSQL instance exists. This runbook creates no cloud resources by itself.

## Free-only guardrails

- Select an Oracle shape explicitly labeled **Always Free** in your eligible home region. Confirm the console estimates **no charges** before creating any resource. Do not opt into paid compute, disks, load balancers, managed databases, paid DNS, extra backups or other add-ons.
- Size an eligible ARM64 Ampere A1 Flex VM only within your **remaining** Always Free OCPU/RAM allowance. Count the boot volume, extra disks and backups against the tenancy's shared free allowances.
- One VM runs Caddy, Express and private PostgreSQL via Docker Compose. No Kubernetes, GHCR or Object Storage is required for initial deployment.
- Use SSH keys, restrict SSH to your IP, permit TCP 80/443 and optionally UDP 443; **never** permit public inbound 5432 (DB) or 4000 (Express). Open the matching OCI security rules and Linux firewall entries.
- Provide an actual DNS A record pointing a domain or free subdomain you control to the instance IP. Caddy uses that hostname to request HTTPS. Do not use an unowned placeholder domain.

## VM preparation

Create an eligible Ubuntu ARM64 VM manually in the Oracle Cloud console, install Docker Engine and the Docker Compose plugin from trusted packages, and ensure ports 80/443 are free. Keep the OS updated.

From your VM:

~~~sh
git clone https://github.com/SanamRai001/reposcout.git
cd reposcout
git checkout main
git pull --ff-only origin main
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
~~~

Set all placeholders in deploy/.env. SITE_ADDRESS is your **real hostname without https://**. Choose a strong random URL-safe POSTGRES_PASSWORD and use precisely the same secret in DATABASE_URL, whose host must remain postgres (the private Compose DNS name). Percent-encode password characters reserved in URLs, or stick to URL-safe characters. GITHUB_TOKEN is optional for initial read-only browsing, but strongly recommended for bounded GitHub ingestion; use minimal scopes. Empty MODERATION_REVIEWERS_JSON disables authenticated moderation until explicitly configured. Never commit the real .env or tokens.

## Validate, build and start

~~~sh
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build api web
docker compose --env-file deploy/.env -f deploy/compose.yaml up --no-build -d --wait
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
~~~

Startup sequence: PostgreSQL becomes healthy, the one-shot migration service completes, Express starts and passes its /ready database check, and finally Caddy serves the built SPA. Neither PostgreSQL nor Express publishes host ports. Caddy serves static Vite assets, reverse-proxies /api and /health and /ready without stripping their paths, and rewrites direct /contribute requests and ranking URLs to index.html. Unknown API and missing hashed assets correctly return 404, not HTML.

Native multi-architecture Node/Caddy/Postgres images let the same Dockerfile build on the Oracle Ampere ARM64 machine. The runtime API image currently retains locked developer dependencies because migration and ingestion CLIs need node-pg-migrate and tsx; compile those CLIs before optimizing image size.

## Verify the *real* site

After DNS and public HTTPS work, from a computer with Node 24:

~~~sh
node deploy/smoke.mjs https://YOUR_ACTUAL_REPOSCOUT_HOST
~~~

This checks HTTP response and API contract for /, the Hidden Gems and Rising query links, /contribute with/without filters, /health, /ready, catalog, filtered search, both ranking endpoints, contribution issues, and API/asset error isolation. It never returns fake repositories. It logs the sampled counts. An empty production catalog, issue list or Rising historical eligibility is a **data coverage gap**, not proof of browser failure or a reason to create mock results.

For browser acceptance, open all four discovery links (Catalog, Hidden Gems, Rising, Find contributions) on mobile and desktop, reload /contribute directly, test filter changes and Back/Forward, and check that real GitHub issue links/timestamps are sensible.

## Controlled production data operations

A freshly migrated DB has no public inventory. Existing moderation/listing boundaries remain authoritative: initial ingestion does **not** automatically publish an unreviewed repository. Consult the ingestion and moderation docs before approving your curated seed corpus.

Once your DB and API are healthy, these existing commands can run through the API image:

~~~sh
# Example repository ingestion; follow listing/moderation process afterwards:
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm --no-deps api npm run ingest:repository -w @reposcout/api -- owner/repository

# Existing bounded issue-observation operation for listed repositories:
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm --no-deps api npm run ingest:contribution-issues -w @reposcout/api -- 20 50

# Schedule at most once per UTC day, and only after reviewing GitHub quota:
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm --no-deps api npm run maintain:snapshots -w @reposcout/api -- 25 100
~~~

Issue ingestion is limited and may return a cursor/retry time; daily snapshot maintenance already uses a database advisory lock. Rising needs real historical 7/30-day observations, so a new instance may properly show no qualifying rows.

## Back up and update safely

Back up before changes, and copy validated backup files **off the VM** to storage you control within its free allowance:

~~~sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T postgres pg_dump -U reposcout -d reposcout -Fc > "reposcout-$(date -u +%Y%m%dT%H%M%SZ).dump"
~~~

Preserve named postgres_data, caddy_data and caddy_config volumes. Never run docker compose down -v on a production DB. Before upgrading, record the known-good Git SHA, inspect migration changes and take a restorable backup. Then pull main, rebuild and use up --no-build -d --wait. A code rollback is NOT an automatic PostgreSQL schema rollback.

## Verification boundary and remaining blockers

The OCI Deployment Smoke GitHub workflow tests the full *real-container stack* on disposable GitHub-hosted CI: PostgreSQL 16, migrations, Express, production Vite build and Caddy in HTTP-only CI mode. It does not connect to Oracle, register DNS, create resources or use actual GitHub catalog inventory.

Completing an actual public deployment still needs your OCI instance, accessible SSH, real domain/DNS, a private deploy/.env, and subsequent real-site smoke. Production GitHub dataset freshness and operational backups must be verified separately.
