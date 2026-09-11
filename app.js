import { estimate } from './tax.js';

const euro = new Intl.NumberFormat('en-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const form = document.querySelector('#calc');
const result = document.querySelector('#result');
const errorBox = document.querySelector('#error');
const set = (id, text) => {
  document.querySelector(id).textContent = text;
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const data = new FormData(form);
  const netIncome = Number(data.get('netIncome'));
  const otherTaxableIncome = Number(data.get('otherTaxableIncome')) || 0;

  if (!Number.isFinite(netIncome) || netIncome < 0) {
    errorBox.textContent = 'Please enter a freelance income of 0 or more.';
    errorBox.hidden = false;
    result.hidden = true;
    return;
  }

  const r = estimate({ netIncome, status: data.get('status'), otherTaxableIncome });

  set('#r-income', euro.format(r.netIncome));
  set('#r-social', euro.format(r.socialContributions.total));
  set(
    '#r-social-note',
    r.socialContributions.minimumApplied
      ? `(charged on the ${euro.format(r.socialContributions.basis)} minimum basis)`
      : '',
  );
  set('#r-tax', euro.format(r.incomeTax.total));
  set('#r-total', euro.format(r.totalDue));
  set('#r-left', euro.format(r.netAfterEverything));
  set('#r-rate', `${r.effectiveRate.toFixed(1)}%`);
  set(
    '#r-quarterly',
    `Social contributions are paid quarterly: roughly ${euro.format(
      r.socialContributions.total / 4,
    )} per quarter. Estimate only.`,
  );

  result.hidden = false;
});
