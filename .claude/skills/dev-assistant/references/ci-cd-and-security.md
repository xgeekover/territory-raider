# Reference — CI/CD & Supply-Chain Security

Loaded on demand by the **[Deployment Agent]** and the **Quality Gates** stage. Supply-chain integrity
is the defining security theme of 2026: the build path itself is the attack surface, so these checks
run *in the pipeline*, not as an afterthought.

The highest-leverage single control is the **base container image** — standard public images ship
~50–60 known CVEs; a minimal/distroless source-built image cuts that to single digits.

---

## What each gate does

| Gate | Tool (pick one) | Catches |
|---|---|---|
| **SCA** (deps) | Trivy · Grype · Dependabot/Renovate | Known-vulnerable dependencies & transitive drift |
| **SBOM** | Syft · CycloneDX | "What's actually in this artifact" — required for provenance/audit |
| **Secret scan** | gitleaks · trufflehog | Committed keys/tokens before they leak |
| **SAST** | CodeQL · Semgrep | Code-level vulns (injection, unsafe deserialization) |
| **Container scan** | Trivy image | CVEs in the built image layers |
| **Signing / provenance** | cosign (Sigstore) · SLSA | Proves *who built this* and *that it wasn't tampered* |

Rule of thumb: **fail the build** on secrets and on new High/Critical CVEs with a fix available;
**warn** on the rest so you don't block delivery on noise ("shift smart", not just "shift left").

---

## `.github/workflows/ci.yml` — build, test, scan

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

permissions:
  contents: read
  security-events: write   # upload SARIF to the Security tab

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-java@v5
        with: { distribution: temurin, java-version: '21', cache: maven }
      - name: Test (JUnit 5 + Testcontainers)
        run: ./mvnw -B verify          # Testcontainers needs Docker — present on GH runners

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4     # reads packageManager from package.json
      - uses: actions/setup-node@v5
        with: { node-version: '22', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome ci .       # lint + format check (or: pnpm lint)
      - run: pnpm test -- --run         # Vitest
      - run: pnpm build
      - name: E2E (Playwright)
        run: |
          pnpm exec playwright install --with-deps chromium
          pnpm exec playwright test

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
      - name: Dependency & filesystem scan (Trivy)
        uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: fs
          scanners: vuln,secret,misconfig
          severity: HIGH,CRITICAL
          exit-code: '1'               # fail on High/Critical
          format: sarif
          output: trivy.sarif
      - name: Upload Trivy SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: trivy.sarif }

  codeql:
    runs-on: ubuntu-latest
    permissions: { security-events: write, actions: read, contents: read }
    strategy:
      matrix:
        language: [java-kotlin, javascript-typescript]
    steps:
      - uses: actions/checkout@v5
      - uses: github/codeql-action/init@v3
        with: { languages: ${{ matrix.language }} }
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

---

## `.github/workflows/release.yml` — build image, SBOM, sign

Runs on tags. Builds the container, generates an SBOM, pushes, and signs with **keyless** cosign
(OIDC — no long-lived keys to leak).

```yaml
name: Release
on:
  push: { tags: ['v*'] }

permissions:
  contents: read
  packages: write
  id-token: write          # required for cosign keyless (Sigstore OIDC)

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Spring Boot: prefer Buildpacks over a hand-written Dockerfile (layered, non-root by default)
      - uses: actions/setup-java@v5
        with: { distribution: temurin, java-version: '21', cache: maven }
      - name: Build OCI image (Cloud Native Buildpacks)
        run: >
          ./mvnw -B spring-boot:build-image
          -Dspring-boot.build-image.imageName=ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: docker push ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Generate SBOM (Syft, CycloneDX)
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          format: cyclonedx-json
          output-file: sbom.cdx.json

      - name: Scan the built image (Trivy)
        uses: aquasecurity/trivy-action@0.28.0
        with: { scan-type: image, image-ref: 'ghcr.io/${{ github.repository }}:${{ github.ref_name }}',
                severity: HIGH,CRITICAL, exit-code: '0' }   # warn (don't block release)

      - name: Sign image + attest SBOM (cosign keyless)
        run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          cosign attest --yes --type cyclonedx --predicate sbom.cdx.json \
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
      - uses: actions/upload-artifact@v4
        with: { name: sbom, path: sbom.cdx.json }
```

Verify downstream:
```bash
cosign verify ghcr.io/<org>/<repo>:<tag> \
  --certificate-identity-regexp 'https://github.com/<org>/<repo>/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

---

## Container hardening checklist (Deployment Agent)
- **Minimal/distroless base** (e.g. `gcr.io/distroless/java21-debian12`, or Buildpacks/Jib output) — not a full OS image.
- **Non-root** user; read-only root filesystem where possible.
- **Pin by digest** (`@sha256:…`), not floating tags, for reproducibility.
- **No secrets in layers** — inject at runtime (env / mounted secret), scan with Trivy `secret`.
- **Multi-stage** build: build deps stay out of the runtime image.
- For Spring Boot, **Buildpacks** (`spring-boot:build-image`) or **Jib** beat a hand-written Dockerfile; for fastest cold start / lowest memory, evaluate a **GraalVM native image**.

## Kubernetes (when applicable)
- Set `resources.requests/limits`, `livenessProbe`/`readinessProbe`.
- `securityContext`: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, drop all capabilities.
- Consider an admission policy (OPA/Kyverno) to reject unsigned images.
