import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOCIAL,
  TAX,
  calculateSocialContributions,
  calculateIncomeTax,
  estimate,
} from './tax.js';

/** Expected values below are hand-computed from the constants in tax.js. */
const closeTo = (actual, expected, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test('low income, hoofdberoep: the minimum income basis kicks in', () => {
  const social = calculateSocialContributions(10000, 'hoofdberoep');

  assert.equal(social.minimumApplied, true);
  assert.equal(social.basis, SOCIAL.minimumIncomeHoofdberoep);
  // 18144.98 * 0.205 = 3719.7209 statutory, + 3.5% fee.
  closeTo(social.statutory, 3719.72);
  closeTo(social.total, 3849.91);
  // Contributions exceed 20.5% of actual income precisely because of the floor.
  assert.ok(social.total > 10000 * SOCIAL.rate);
});

test('low income, hoofdberoep: full estimate leaves most of the income', () => {
  const r = estimate({ netIncome: 20000, status: 'hoofdberoep' });

  // 20000 * 0.205 = 4100 statutory, * 1.035 = 4243.50 with fee.
  closeTo(r.socialContributions.total, 4243.5);
  assert.equal(r.socialContributions.minimumApplied, false);
  // Taxable = 20000 - 4243.50 = 15756.50, all inside the 25% bracket.
  closeTo(r.taxableFreelanceIncome, 15756.5);
  // 15756.50 * 0.25 = 3939.125, minus 10570 * 0.25 = 2642.50 credit = 1296.625,
  // plus 7% municipal surcharge = 1387.39.
  closeTo(r.incomeTax.total, 1387.39);
  closeTo(r.totalDue, 5630.89);
  closeTo(r.netAfterEverything, 14369.11);
  assert.ok(r.effectiveRate > 25 && r.effectiveRate < 30);
});

test('high income: contributions are capped, income tax is not', () => {
  const r = estimate({ netIncome: 200000, status: 'hoofdberoep' });

  // 75652.34 * 0.205 + (111490.95 - 75652.34) * 0.1416 = 20583.4769 statutory,
  // nothing above the second ceiling, + 3.5% fee = 21303.90.
  closeTo(r.socialContributions.statutory, 20583.48);
  closeTo(r.socialContributions.total, 21303.9);
  closeTo(r.taxableFreelanceIncome, 178696.1);
  // Brackets: 3955 + 4840 + 9180 + 130376.10 * 0.50 = 83163.05,
  // minus 2642.50 credit = 80520.55, + 7% = 86156.99.
  closeTo(r.incomeTax.total, 86156.99);
  closeTo(r.totalDue, 107460.89);
  assert.ok(r.effectiveRate > 50);
});

test('contributions stop growing above the second ceiling', () => {
  const atCeiling = calculateSocialContributions(SOCIAL.secondCeiling, 'hoofdberoep');
  const wayAbove = calculateSocialContributions(500000, 'hoofdberoep');

  closeTo(wayAbove.total, atCeiling.total);
});

test('hoofdberoep vs bijberoep differ on the same income', () => {
  const income = 10000;
  const main = calculateSocialContributions(income, 'hoofdberoep');
  const side = calculateSocialContributions(income, 'bijberoep');

  // Bijberoep has no minimum basis: it pays on the real 10000.
  assert.equal(side.minimumApplied, false);
  closeTo(side.total, 10000 * 0.205 * 1.035); // 2121.75
  assert.ok(main.total > side.total);
  closeTo(main.total - side.total, 1728.16);

  // Above the minimum basis the two statuses converge.
  const mainHigh = calculateSocialContributions(50000, 'hoofdberoep');
  const sideHigh = calculateSocialContributions(50000, 'bijberoep');
  closeTo(mainHigh.total, sideHigh.total);
});

test('bijberoep below the exemption threshold owes no contributions', () => {
  const below = calculateSocialContributions(SOCIAL.exemptionThresholdBijberoep - 1, 'bijberoep');
  const above = calculateSocialContributions(SOCIAL.exemptionThresholdBijberoep + 1, 'bijberoep');

  assert.equal(below.total, 0);
  assert.ok(above.total > 0);
});

test('bijberoep income is taxed on top of the salary, at marginal rates', () => {
  const alone = estimate({ netIncome: 10000, status: 'bijberoep' });
  const onTopOfSalary = estimate({
    netIncome: 10000,
    status: 'bijberoep',
    otherTaxableIncome: 45000,
  });

  // Same contributions either way - only the income tax changes.
  closeTo(onTopOfSalary.socialContributions.total, alone.socialContributions.total);
  assert.ok(
    onTopOfSalary.incomeTax.total > alone.incomeTax.total,
    'freelance income stacked on a salary must be taxed harder',
  );
  // Salary of 45000 pushes the freelance tranche into the 45%/50% brackets.
  assert.ok(onTopOfSalary.effectiveRate > 60);
});

test('income tax: tax-free allowance cancels tax on tiny incomes', () => {
  assert.equal(calculateIncomeTax(0).total, 0);
  assert.equal(calculateIncomeTax(TAX.taxFreeAllowance).total, 0);
  assert.ok(calculateIncomeTax(TAX.taxFreeAllowance + 1000).total > 0);
});

test('income tax brackets are progressive at the boundaries', () => {
  const step = 100;
  const justBelow = calculateIncomeTax(27920)._exact;
  const justAbove = calculateIncomeTax(27920 + step)._exact;

  // The tranche above 27920 is taxed at 45% (+7% surcharge), not 40%.
  closeTo(justAbove - justBelow, step * 0.45 * 1.07);
});

test('invalid input is rejected', () => {
  assert.throws(() => estimate({ netIncome: 'lots' }), TypeError);
  assert.throws(() => estimate({ netIncome: 1000, status: 'student' }), RangeError);
});
