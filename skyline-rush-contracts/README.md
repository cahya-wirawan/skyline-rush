# Skyline Rush Contracts

Shared OpenAPI 3.0 specification and JSON Schema definitions for Skyline Rush.

## Contents
- `openapi.yaml`: The single source of truth for the REST API surface (`/v1/*`).
- `schemas/supply-drop-table.schema.json`: JSON Schema enforcing probability table structure and odds transparency.
- `schemas/content-pack.schema.json`: JSON Schema for remote District content bundles delivered via CDN.

## Validation
```bash
npm install
npm test
```
