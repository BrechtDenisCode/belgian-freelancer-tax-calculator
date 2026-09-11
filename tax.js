/**
 * Belgian freelancer tax & social contribution ESTIMATOR.
 *
 * THIS IS AN ESTIMATE, NOT TAX ADVICE.
 *
 * The model is deliberately simplified. It ignores, among other things:
 * dependants and family situation, marital quotient, joint taxation,
 * withholding tax already paid, VAT, regional tax reductions, pension
 * savings / VAPZ deductions, flat-rate expense allowances, the first-three-
 * years starter reductions on social contributions, and the fact that
 * social contributions are provisional and later corrected against real
 * income.
 *
 * All rate constants below are APPROXIMATE and MAY BE OUT OF DATE. They are
 * indexed by the Belgian government every year. Verify against the official
 * sources listed next to each block before treating any output as real.
 */

/**
 * Social insurance contribution parameters for the self-employed.
 *
 * Approximate, recent-years values (RSVZ/INASTI publishes the indexed
 * figures annually at https://www.rsvz.be / https://www.inasti.be).
 * PLACEHOLDER PRECISION: the ceilings, the minimum income basis and the
 * bijberoep exemption threshold are indexed every year and the values here
 * have NOT been verified against the current income year.
 */
export const SOCIAL = {
  /** Standard contribution rate on the income basis. */
  rate: 0.205,
  /** Reduced rate on the tranche between the two ceilings. */
  reducedRate: 0.1416,
  /** Above this income, contributions are charged at `reducedRate`. */
  firstCeiling: 75652.34,
  /** Above this income, no further contributions are due. */
  secondCeiling: 111490.95,
  /** Hoofdberoep pays on at least this income basis, even if earning less. */
  minimumIncomeHoofdberoep: 18144.98,
  /** Bijberoep earning less than this owes no contributions at all. */
  exemptionThresholdBijberoep: 1865.45,
  /**
   * Social insurance fund management fee, charged on top of the statutory
   * contribution. Funds differ; ~3.05%-3.40% observed (memory/CUSTOMER.md).
   * 3.5% used here as a slightly conservative round placeholder.
   */
  managementFeeRate: 0.035,
};

/**
 * Personal income tax (personenbelasting) parameters.
 *
 * Bracket boundaries and the tax-free allowance are approximately those of
 * income year 2024 / assessment year 2025 (FOD Financien / SPF Finances,
 * https://financien.belgium.be). PLACEHOLDER PRECISION: not verified against
 * the current income year, and the tax-free allowance ignores increases for
 * dependent children.
 */
export const TAX = {
  brackets: [
    { upTo: 15820, rate: 0.25 },
    { upTo: 27920, rate: 0.4 },
    { upTo: 48320, rate: 0.45 },
    { upTo: Infinity, rate: 0.5 },
  ],
  /** Belastingvrije som: granted as a credit at the lowest bracket rates. */
  taxFreeAllowance: 10570,
  /**
   * Municipal surcharge (gemeentebelasting/taxe communale) on the tax due.
   * Varies per municipality, roughly 0%-9%; 7% used as a placeholder average.
   */
  municipalSurchargeRate: 0.07,
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Progressive tax over a bracket table, applied from zero. */
function applyBrackets(income, brackets) {
  let tax = 0;
  let floor = 0;
  for (const { upTo, rate } of brackets) {
    if (income <= floor) break;
    tax += (Math.min(income, upTo) - floor) * rate;
    floor = upTo;
  }
  return tax;
}

/**
 * Statutory social contributions plus the fund's management fee.
 *
 * @param {number} netIncome Annual professional income after expenses,
 *   before social contributions and tax. This is the basis RSVZ uses.
 * @param {'hoofdberoep'|'bijberoep'} status Main or secondary occupation.
 */
export function calculateSocialContributions(netIncome, status = 'hoofdberoep') {
  const income = Math.max(0, netIncome);

  if (status === 'bijberoep' && income < SOCIAL.exemptionThresholdBijberoep) {
    return { basis: income, statutory: 0, managementFee: 0, total: 0, minimumApplied: false };
  }

  // Only hoofdberoep has a minimum income basis; bijberoep pays on real income.
  const minimumApplied =
    status === 'hoofdberoep' && income < SOCIAL.minimumIncomeHoofdberoep;
  const basis = minimumApplied ? SOCIAL.minimumIncomeHoofdberoep : income;

  const statutory = applyBrackets(basis, [
    { upTo: SOCIAL.firstCeiling, rate: SOCIAL.rate },
    { upTo: SOCIAL.secondCeiling, rate: SOCIAL.reducedRate },
    { upTo: Infinity, rate: 0 },
  ]);
  const managementFee = statutory * SOCIAL.managementFeeRate;

  return {
    basis: round2(basis),
    statutory: round2(statutory),
    managementFee: round2(managementFee),
    total: round2(statutory + managementFee),
    minimumApplied,
    _exact: statutory + managementFee,
  };
}

/**
 * Personal income tax on a taxable income, including municipal surcharge.
 * The tax-free allowance is applied as a credit at the bottom bracket rates,
 * which is how the Belgian calculation works.
 */
export function calculateIncomeTax(taxableIncome) {
  const income = Math.max(0, taxableIncome);
  const gross = applyBrackets(income, TAX.brackets);
  const credit = applyBrackets(Math.min(TAX.taxFreeAllowance, income), TAX.brackets);
  const base = Math.max(0, gross - credit);
  const municipal = base * TAX.municipalSurchargeRate;

  return {
    base: round2(base),
    municipalSurcharge: round2(municipal),
    total: round2(base + municipal),
    _exact: base + municipal,
  };
}

/**
 * Full estimate for one freelancer.
 *
 * @param {object} input
 * @param {number} input.netIncome Annual freelance income after expenses.
 * @param {'hoofdberoep'|'bijberoep'} [input.status]
 * @param {number} [input.otherTaxableIncome] Other taxable income already
 *   earned in the same year, typically a salary for a bijberoep freelancer.
 *   Freelance income is taxed on top of it, so it lands in higher brackets.
 */
export function estimate({ netIncome, status = 'hoofdberoep', otherTaxableIncome = 0 }) {
  if (!Number.isFinite(netIncome)) throw new TypeError('netIncome must be a number');
  if (status !== 'hoofdberoep' && status !== 'bijberoep') {
    throw new RangeError('status must be "hoofdberoep" or "bijberoep"');
  }
  const other = Math.max(0, otherTaxableIncome);

  const social = calculateSocialContributions(netIncome, status);
  // Social contributions (fund fee included) are deductible professional costs.
  const taxableFreelanceIncome = Math.max(0, netIncome - social._exact);

  const taxWithFreelance = calculateIncomeTax(other + taxableFreelanceIncome);
  const taxWithoutFreelance = calculateIncomeTax(other);
  // Only the extra tax caused by the freelance income is attributed to it.
  const incomeTaxOnFreelance = Math.max(
    0,
    taxWithFreelance._exact - taxWithoutFreelance._exact,
  );

  const totalDue = social._exact + incomeTaxOnFreelance;

  return {
    netIncome: round2(netIncome),
    status,
    otherTaxableIncome: round2(other),
    socialContributions: {
      basis: social.basis,
      statutory: social.statutory,
      managementFee: social.managementFee,
      total: social.total,
      minimumApplied: social.minimumApplied,
    },
    taxableFreelanceIncome: round2(taxableFreelanceIncome),
    incomeTax: {
      base: round2(incomeTaxOnFreelance / (1 + TAX.municipalSurchargeRate)),
      municipalSurcharge: round2(
        incomeTaxOnFreelance - incomeTaxOnFreelance / (1 + TAX.municipalSurchargeRate),
      ),
      total: round2(incomeTaxOnFreelance),
    },
    totalDue: round2(totalDue),
    netAfterEverything: round2(netIncome - totalDue),
    effectiveRate: netIncome > 0 ? round2((totalDue / netIncome) * 100) : 0,
  };
}
