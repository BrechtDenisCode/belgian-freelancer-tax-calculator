# MVP calculator

Single-page estimator: annual freelance income in, social contributions and
personal income tax out. No build step, no dependencies, no external services,
no analytics, no signup.

**Output is an ESTIMATE, not tax advice.**

## Files

| File           | What it is                                                |
| -------------- | --------------------------------------------------------- |
| `tax.js`       | All calculation logic and rate constants. No DOM.          |
| `tax.test.js`  | Tests for the calculation logic (`node --test`).           |
| `index.html`   | The page: form, result table, disclaimer, rate explainer.  |
| `app.js`       | Thin glue between the form and `tax.js`.                   |
| `VERSION.txt`  | Marks the current build version.                           |

## Run

```sh
npm test        # node --test
npm start       # python -m http.server 8000, then open localhost:8000
```

A static server is needed because `app.js` is an ES module; `file://` won't
load it.

## Rates: read this before trusting a number

Every constant lives at the top of `tax.js` with a comment naming its source
and its caveat. They are **approximate and not verified against the current
income year**. Belgian rates are indexed annually.

- Social contributions: 20.5% up to ~EUR 75,652.34, 14.16% up to
  ~EUR 111,490.95, 0% above; hoofdberoep minimum income basis ~EUR 18,144.98;
  bijberoep exemption below ~EUR 1,865.45; 3.5% fund management fee.
  Official source to verify against: RSVZ/INASTI.
- Income tax: 25/40/45/50% at EUR 15,820 / 27,920 / 48,320, tax-free allowance
  EUR 10,570 (roughly income year 2024), 7% municipal surcharge placeholder.
  Official source to verify against: FOD Financien / SPF Finances.

**Verifying these against the official current-year figures is a prerequisite
for showing this to a real user.**

## Deliberately not modelled

Dependants and family situation, marital quotient, joint taxation, VAT,
prepayments/withholding already paid, VAPZ and pension savings, flat-rate
expense allowances, the starter reduction on social contributions in the first
years, and the provisional-then-corrected nature of contributions.

Bijberoep freelancers can enter other taxable income (their salary) so the
freelance tranche is taxed at the marginal rate on top of it, rather than from
zero.
