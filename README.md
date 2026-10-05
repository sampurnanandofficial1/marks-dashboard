# Academic Desk — Report Card Generator

A marks dashboard for Sampurn Anand with 26 subjects imported from visible and hidden sheets of Marks Databse.xlsx.

## Workflow

1. In **Report card**, choose **Add subject** or **Edit / upload PDF**.
2. Enter the subject name, credits and term.
3. Upload a text-based marks PDF and review the extracted students and component headings.
4. Save. The subject table, percentile grades and credit-weighted GPA update immediately.

Subject rows can be exported as CSV and opened in Excel. Report cards can be printed to PDF.

PDFs are read in the browser using a locally served PDF.js worker. Extracted subject data is saved in D1; uploaded PDFs are saved in R2. Data persists across browsers. Hosting is owner-private. Keep the repository private because the seed data includes student marks.

## Grading

Rank implements RANK.EQ(total, totals, 0) + COUNTIF(current-row-to-end, total) - 1. Ties depend on the original source order. Z-score uses population standard deviation. Percentile implements PERCENTRANK.EXC on unrounded Z-scores with Excel's default three-decimal truncation. Each subject uses its own cohort.

Grade boundaries: A+ 95%, A 85%, A− 75%, B+ 53.34%, B 31.68%, B− 10.02%, C+ 5%, C 2.5%, C− 1%, D below 1%. Points run from 10 to 1.

Calculated grades are estimates. Sampurn's separately recorded Term 1–3 grades from the original workbook remain available. GPA excludes missing subjects and zero-credit subjects. Missing results never become zero marks.

## PDF support

Supports text-based IIM Lucknow result sheets containing PGP/41 roll numbers, student names, numeric component marks and a final total. Tested with all 117 rows in the supplied SCAS PDF. Scanned PDFs require OCR first. Unsupported or inconsistent rows block saving and show an error. Generic component headers can be edited before saving.

## Development

Use Node 24 and the existing pnpm lockfile. Run pnpm install, pnpm dev and pnpm build. Logical database and file bindings are defined in .openai/hosting.json. Drizzle migrations live in drizzle/. Production hosting applies migrations before publishing.

Validation:

- pnpm exec tsc --noEmit
- node --experimental-strip-types scripts/verify.mjs /path/to/SCAS.pdf
- node scripts/verify-api.mjs LOCAL_PREVIEW_URL /path/to/SCAS.pdf

The API test changes credits only in the selected local development database and restores them afterward.
