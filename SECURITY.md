# Security Policy

Hanzo Social is a hard fork of [`gitroomhq/postiz-app`](https://github.com/gitroomhq/postiz-app) (AGPL-3.0). Upstream security policy still applies to the unforked codebase; this policy covers the Hanzo Social deployment and our additions.

## Scope

- The fork repository (`github.com/hanzoai/social`) and the Hanzo Social deployment at https://social.hanzo.ai
- Hanzo integration code (KMS sync, IAM client, bot `/social` surface)
- Container images published under `ghcr.io/hanzoai/social-{backend,frontend,orchestrator}`

For vulnerabilities in upstream code paths we have not modified, prefer reporting to gitroomhq/postiz-app upstream so the broader user base benefits, then notify us so we can patch.

## Reporting

Report vulnerabilities privately via the [GitHub Security Advisory system](https://github.com/hanzoai/social/security/advisories/new) on this repo, or email `security@hanzo.ai`.

When reporting, please include:
- A clear description of the vulnerability
- Proof of concept (PoC), where possible
- Reproduction steps
- Impact assessment

## AI-generated reports

Reports that appear to be LLM-generated without meaningful human analysis — lacking a working PoC, reproducible steps, or accurate impact assessment — will be closed without detailed response.

AI-assisted reports are welcome when validated by the reporter with a PoC, reproduction steps, and impact assessment.

## Response timeline

- Acknowledgment within 72 hours.
- Triage within 7 days.
- Critical fix within 90 days of triage; non-critical within 180 days.
- CVE publication within 24 hours of remediation release.
