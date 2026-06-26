# Frontend Architecture

The frontend is organized around domain boundaries instead of technical file types.

## Layers

- `src/app`: application composition, providers, routing, and app-level pages.
- `src/domains/<domain>/domain`: business types and pure rules without React or HTTP.
- `src/domains/<domain>/application`: React hooks and use-cases that orchestrate domain rules.
- `src/domains/<domain>/infrastructure`: API gateways and transport-specific code.
- `src/domains/<domain>/presentation`: pages and components owned by that domain.
- `src/shared`: reusable UI primitives, assets, hooks, and technical utilities.

## Domains

- `auth`: session state, credentials/OAuth API access, login/register/callback screens.
- `jobs`: job entities, filtering/deduplication/pagination rules, scraper/job API access, dashboard UI.
- `marketing`: public landing page sections.

## Import policy

Code should import from `@/app`, `@/domains`, or `@/shared`. Legacy technical folders such as `src/components`, `src/pages`, `src/hooks`, `src/services`, `src/context`, `src/lib`, and `src/types` were removed to keep a single domain-oriented structure.
