# Report Card Generator

A responsive marks dashboard with subject sheets, student report cards, credit-weighted GPA, CSV export and printable reports.

## Live hosting

The frontend deploys to GitHub Pages from this repository using the included Actions workflow. The PDF marks API deploys from the same repository to Railway and stores records and PDFs in a persistent volume at /data.

API: https://marks-api-production-6abe.up.railway.app

## Use

Select a student and term to view the report. In Report Card Generator, add or edit a subject, enter its name and credits, upload a text-based marks PDF, review the extracted columns and rows, and save. The subject sheet and report update immediately. Scanned image PDFs need OCR first.

The original workbook's 26 subject sheets, including hidden sheets, are loaded. Recorded Term 1–3 grades can be viewed separately from grades estimated using the supplied percentile thresholds.

## Grading

Rank reproduces RANK.EQ plus the descending COUNTIF tie adjustment. Z-score uses population standard deviation. Percentile uses Excel's exclusive rank convention with its default three-decimal precision. Grade boundaries are 0.95, 0.85, 0.75, 0.5334, 0.3168, 0.1002, 0.05, 0.025, and 0.01, mapping A+ through D to points 10 through 1. Missing subjects are excluded from available-credit GPA. A constant-score cohort has undefined Z-score and percentile.

## Development

Node 24 and pnpm 11.25.0. Run pnpm install, then pnpm run build:web for the frontend. The PDF worker is generated from the installed pdfjs-dist package. Set VITE_API_URL for frontend builds.

For the API, set ACCESS_CODE, DATA_DIR and PORT, then run node --experimental-strip-types backend/server.mjs. The Dockerfile contains this API runtime. The access code is stored as a deployment variable, never in source.

Validation included matching all 117 rows in the sample SCAS PDF to the workbook and checking ties, grade thresholds, duplicate IDs, credits, CORS, uploads and persistence across restarts.
