/*
  CoderCo ROI Calculator (user-friendly)

  UX goals:
  - GBP-first (no currency/conversion clutter).
  - Default outcome model: typical average (£55k after 6–12 months).
  - Only show “advanced” exchange-rate input if the user wants to tweak assumptions.

  Maths:
  - Salary uplift starts after `monthsToOutcome`.
  - Total net at horizon = (months with uplift × monthly uplift) − total cost.
*/

const els = {
  form: document.getElementById('roiForm'),

  // Inputs
  currentSalary: document.getElementById('currentSalary'),
  targetSalary: document.getElementById('targetSalary'),
  outcomeTypical: document.getElementById('outcomeTypical'),
  outcomeCustom: document.getElementById('outcomeCustom'),
  customTargetWrap: document.getElementById('customTargetWrap'),

  monthsToOutcome: document.getElementById('monthsToOutcome'),
  monthsToOutcomeLabel: document.getElementById('monthsToOutcomeLabel'),

  planMonthly: document.getElementById('planMonthly'),
  planAnnualUpfront: document.getElementById('planAnnualUpfront'),
  planInstallments: document.getElementById('planInstallments'),

  monthsInProgram: document.getElementById('monthsInProgram'),
  monthsInProgramLabel: document.getElementById('monthsInProgramLabel'),
  monthsInProgramWrap: document.getElementById('monthsInProgramWrap'),

  otherCosts: document.getElementById('otherCosts'),
  usdToGbp: document.getElementById('usdToGbp'),
  planNotice: document.getElementById('planNotice'),

  copyLinkBtn: document.getElementById('copyLinkBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  toast: document.getElementById('toast'),

  recalculateBtn: document.getElementById('recalculateBtn'),
  resetBtn: document.getElementById('resetBtn'),

  // Results
  kpiUplift: document.getElementById('kpiUplift'),
  kpiCost: document.getElementById('kpiCost'),
  kpiPayback: document.getElementById('kpiPayback'),
  kpiBreakeven: document.getElementById('kpiBreakeven'),

  net12: document.getElementById('net12'),
  roi12: document.getElementById('roi12'),
  net24: document.getElementById('net24'),
  roi24: document.getElementById('roi24'),
  net36: document.getElementById('net36'),
  roi36: document.getElementById('roi36'),

  calcExplainer: document.getElementById('calcExplainer'),
};

const PRICING_USD = {
  monthly: 199,
  annualUpfront: 1999,
  installmentPrice: 799,
  installmentCount: 3,
};

// Default FX assumption (user can override under “Advanced”).
const DEFAULT_USD_TO_GBP = 0.8;

const TYPICAL_TARGET_GBP = 55000;

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('toast--show');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    els.toast.classList.remove('toast--show');
  }, 1800);
}

function legacyCopyText(text) {
  // Synchronous fallback that works in many non-secure contexts.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.left = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

async function copyText(text) {
  // Prefer modern clipboard API when available in a secure context.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }
  return legacyCopyText(text);
}

function getShareBaseUrl() {
  // When running locally, some setups produce `http://[::]:8080/` (IPv6 any-interface),
  // which is confusing and often not usable as a “share” link.
  // Swap common dev hosts to `localhost`.
  const url = new URL(window.location.href);
  const host = url.hostname; // Note: no brackets for IPv6 here (e.g. "::")
  if (host === '::' || host === '0.0.0.0') {
    url.hostname = 'localhost';
  }
  url.search = '';
  url.hash = '';
  return url;
}

function n(v) {
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : null;
}

function clampInt(value, min, max, fallback) {
  const v = Number.parseInt(String(value), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function formatMoney(amount, currency) {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function formatPercent(v) {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(0)}%`;
}

function formatMonths(v) {
  if (!Number.isFinite(v)) return '—';
  if (v <= 0) return '0 months';
  if (v < 1) {
    // Display more specific output for small values (avoid “<1 month”).
    // Use a simple 30-day month for display (the underlying calculation is still monthly-based).
    const days = Math.max(1, Math.ceil(v * 30));
    return `${days} days`;
  }
  return `${Math.round(v)} months`;
}

function readState() {
  const currency = 'GBP';

  const currentSalary = n(els.currentSalary.value);
  const customTarget = n(els.targetSalary.value);

  const outcomeMode = els.outcomeCustom.checked ? 'CUSTOM' : 'TYPICAL';

  const monthsToOutcome = n(els.monthsToOutcome.value) ?? 9;

  const planType = els.planAnnualUpfront.checked
    ? 'ANNUAL_UPFRONT'
    : els.planInstallments.checked
      ? 'ANNUAL_INSTALLMENTS'
      : 'MONTHLY';

  const monthsInProgram = n(els.monthsInProgram.value) ?? 9;
  const otherCostsGbp = n(els.otherCosts.value) ?? 0;

  const usdToGbp = n(els.usdToGbp.value) ?? DEFAULT_USD_TO_GBP;

  return {
    currency,
    currentSalary,
    outcomeMode,
    customTarget,
    monthsToOutcome,
    planType,
    monthsInProgram,
    otherCostsGbp,
    usdToGbp,
  };
}

function applyStateToForm(state) {
  if (state.currentSalary !== undefined) els.currentSalary.value = state.currentSalary ?? '';

  if (state.outcomeMode === 'CUSTOM') {
    els.outcomeCustom.checked = true;
    els.outcomeTypical.checked = false;
    els.targetSalary.value = state.customTarget ?? '';
  } else {
    els.outcomeTypical.checked = true;
    els.outcomeCustom.checked = false;
    els.targetSalary.value = '';
  }

  if (state.monthsToOutcome !== undefined) {
    els.monthsToOutcome.value = String(state.monthsToOutcome);
    els.monthsToOutcomeLabel.textContent = String(state.monthsToOutcome);
  }

  if (state.planType === 'ANNUAL_UPFRONT') {
    els.planAnnualUpfront.checked = true;
  } else if (state.planType === 'ANNUAL_INSTALLMENTS') {
    els.planInstallments.checked = true;
  } else {
    els.planMonthly.checked = true;
  }

  if (state.monthsInProgram !== undefined) {
    els.monthsInProgram.value = String(state.monthsInProgram);
    els.monthsInProgramLabel.textContent = String(state.monthsInProgram);
  }

  if (state.otherCostsGbp !== undefined) els.otherCosts.value = String(state.otherCostsGbp ?? 0);
  if (state.usdToGbp !== undefined) els.usdToGbp.value = String(state.usdToGbp ?? DEFAULT_USD_TO_GBP);
}

function stateToQueryParams(state) {
  const qp = new URLSearchParams();
  if (Number.isFinite(state.currentSalary)) qp.set('s', String(Math.round(state.currentSalary)));
  qp.set('o', state.outcomeMode === 'CUSTOM' ? 'c' : 't');
  if (state.outcomeMode === 'CUSTOM' && Number.isFinite(state.customTarget)) {
    qp.set('t', String(Math.round(state.customTarget)));
  }
  qp.set('m', String(Math.round(state.monthsToOutcome)));
  qp.set('p', state.planType === 'ANNUAL_UPFRONT' ? 'a' : state.planType === 'ANNUAL_INSTALLMENTS' ? 'i' : 'm');
  if (state.planType === 'MONTHLY') qp.set('k', String(Math.round(state.monthsInProgram)));
  if (Number.isFinite(state.otherCostsGbp) && state.otherCostsGbp > 0) qp.set('x', String(Math.round(state.otherCostsGbp)));
  if (Number.isFinite(state.usdToGbp) && state.usdToGbp !== DEFAULT_USD_TO_GBP) qp.set('fx', state.usdToGbp.toFixed(4));
  return qp;
}

function loadStateFromUrl() {
  const url = new URL(window.location.href);
  const qp = url.searchParams;
  if ([...qp.keys()].length === 0) return false;

  const outcome = qp.get('o');
  const plan = qp.get('p');

  const loaded = {
    currentSalary: n(qp.get('s')),
    outcomeMode: outcome === 'c' ? 'CUSTOM' : 'TYPICAL',
    customTarget: n(qp.get('t')),
    monthsToOutcome: clampInt(qp.get('m'), 6, 12, 9),
    planType: plan === 'a' ? 'ANNUAL_UPFRONT' : plan === 'i' ? 'ANNUAL_INSTALLMENTS' : 'MONTHLY',
    monthsInProgram: clampInt(qp.get('k'), 1, 12, 9),
    otherCostsGbp: n(qp.get('x')) ?? 0,
    usdToGbp: n(qp.get('fx')) ?? DEFAULT_USD_TO_GBP,
  };

  // If outcome is custom but target is missing, fall back to typical.
  if (loaded.outcomeMode === 'CUSTOM' && !Number.isFinite(loaded.customTarget)) {
    loaded.outcomeMode = 'TYPICAL';
  }

  applyStateToForm(loaded);
  return true;
}

function programCostUsd(state) {
  if (state.planType === 'MONTHLY') return PRICING_USD.monthly * state.monthsInProgram;
  if (state.planType === 'ANNUAL_UPFRONT') return PRICING_USD.annualUpfront;
  return PRICING_USD.installmentPrice * PRICING_USD.installmentCount;
}

function computeForTarget(state, targetSalaryGbp) {
  const issues = [];

  if (state.currentSalary === null) issues.push('Enter your current annual salary.');
  if (!Number.isFinite(targetSalaryGbp)) issues.push('Enter a valid target salary.');

  const uplift = (targetSalaryGbp ?? 0) - (state.currentSalary ?? 0);
  const monthlyUplift = uplift / 12;

  const costUsd = programCostUsd(state);
  const programCostGbp = costUsd * state.usdToGbp;
  const totalCostGbp = programCostGbp + (state.otherCostsGbp ?? 0);

  const paybackAfterTarget = monthlyUplift > 0 ? totalCostGbp / monthlyUplift : null;
  const breakEvenFromToday = paybackAfterTarget === null ? null : state.monthsToOutcome + paybackAfterTarget;

  function netAtHorizon(horizonMonths) {
    const monthsOfUplift = Math.max(0, horizonMonths - state.monthsToOutcome);
    const net = monthsOfUplift * monthlyUplift - totalCostGbp;
    const roi = totalCostGbp > 0 ? net / totalCostGbp : null;
    return { monthsOfUplift, net, roi };
  }

  // Additional, user-facing warnings
  if (state.currentSalary !== null && uplift <= 0) {
    issues.push('Your target salary is not higher than your current salary, so payback/ROI won’t be meaningful.');
  }
  if (state.planType === 'MONTHLY') {
    issues.push('Monthly (Standard) is positioned for fundamentals + weekly mentoring. Full transformation requires Premium.');
  }

  return {
    issues,
    uplift,
    monthlyUplift,
    costUsd,
    programCostGbp,
    totalCostGbp,
    paybackAfterTarget,
    breakEvenFromToday,
    h12: netAtHorizon(12),
    h24: netAtHorizon(24),
    h36: netAtHorizon(36),
  };
}

function compute(state) {
  if (state.outcomeMode === 'CUSTOM') {
    return { mode: 'CUSTOM', single: computeForTarget(state, state.customTarget) };
  }
  return { mode: 'TYPICAL', single: computeForTarget(state, TYPICAL_TARGET_GBP) };
}

function setDefaults() {
  els.outcomeTypical.checked = true;
  els.outcomeCustom.checked = false;
  els.customTargetWrap.hidden = true;
  els.targetSalary.value = '';

  els.planMonthly.checked = true;
  els.planAnnualUpfront.checked = false;
  els.planInstallments.checked = false;

  els.monthsToOutcome.value = '9';
  els.monthsToOutcomeLabel.textContent = '9';

  els.monthsInProgram.value = '9';
  els.monthsInProgramLabel.textContent = '9';
  els.monthsInProgramWrap.hidden = false;

  els.otherCosts.value = '0';
  els.usdToGbp.value = String(DEFAULT_USD_TO_GBP);
}

function render() {
  const state = readState();
  const out = compute(state);

  // Update range label
  els.monthsToOutcomeLabel.textContent = String(Math.round(state.monthsToOutcome));
  els.monthsInProgramLabel.textContent = String(Math.round(state.monthsInProgram));

  // UI: hide/show blocks
  els.customTargetWrap.hidden = state.outcomeMode !== 'CUSTOM';
  els.monthsInProgramWrap.hidden = state.planType !== 'MONTHLY';
  if (els.planNotice) {
    els.planNotice.style.display = state.planType === 'MONTHLY' ? 'block' : 'none';
  }

  const money = (v) => formatMoney(v, state.currency);

  function renderSingle(single) {
    // KPIs
    els.kpiUplift.textContent = money(single.uplift);
    els.kpiCost.textContent = `${money(single.totalCostGbp)} (priced in USD, estimated at $1 ≈ £${state.usdToGbp.toFixed(2)})`;
    els.kpiPayback.textContent = single.paybackAfterTarget === null ? '—' : formatMonths(single.paybackAfterTarget);
    els.kpiBreakeven.textContent = single.breakEvenFromToday === null ? '—' : formatMonths(single.breakEvenFromToday);

    function renderHorizon(netEl, roiEl, h) {
      netEl.textContent = money(h.net);
      roiEl.textContent = h.roi === null ? '—' : formatPercent(h.roi);
    }

    renderHorizon(els.net12, els.roi12, single.h12);
    renderHorizon(els.net24, els.roi24, single.h24);
    renderHorizon(els.net36, els.roi36, single.h36);

    const expl = [];
    if (single.issues.length) {
      expl.push(
        `<div><strong>Quick checks:</strong><ul>${single.issues
          .map((x) => `<li>${escapeHtml(x)}</li>`)
          .join('')}</ul></div>`
      );
    }

    expl.push(
      `<div><strong>Salary uplift:</strong> (target − current) = ${money(single.uplift)} / year (${money(single.monthlyUplift)} / month)</div>`
    );
    if (out.mode === 'TYPICAL') {
      expl.push(
        `<div><strong>Typical outcome model:</strong> target salary is set to <strong>£${TYPICAL_TARGET_GBP.toLocaleString()}</strong> (average) for this estimate.</div>`
      );
    }
    expl.push(
      `<div><strong>Plan cost estimate:</strong> programme cost is priced in USD (e.g. $199/month). We estimate the GBP equivalent using $1 ≈ £${state.usdToGbp.toFixed(
        2
      )}. One-off costs are added in GBP.</div>`
    );
    expl.push(
      `<div><strong>Timing:</strong> we assume the uplift starts after <strong>${Math.round(
        state.monthsToOutcome
      )} months</strong>. Net gain at 12/24/36 months = (months with uplift × monthly uplift) − total cost.</div>`
    );
    expl.push(
      `<div><strong>Payback display:</strong> if payback is under 1 month, we show it in <strong>days</strong> using <strong>30 days ≈ 1 month</strong> (display-only).</div>`
    );

    els.calcExplainer.innerHTML = expl.join('');
  }

  if (out.mode === 'CUSTOM' || out.mode === 'TYPICAL') {
    renderSingle(out.single);
    return;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function wireEvents() {
  // Outcome mode toggles
  els.outcomeTypical.addEventListener('change', render);
  els.outcomeCustom.addEventListener('change', render);

  els.monthsToOutcome.addEventListener('input', () => {
    els.monthsToOutcomeLabel.textContent = els.monthsToOutcome.value;
    render();
  });

  els.monthsInProgram.addEventListener('input', () => {
    els.monthsInProgramLabel.textContent = els.monthsInProgram.value;
    render();
  });

  // Recompute on any input change
  els.form.addEventListener('input', () => render());

  els.recalculateBtn.addEventListener('click', () => {
    render();
  });

  els.resetBtn.addEventListener('click', () => {
    setDefaults();
    render();
  });

  if (els.copyLinkBtn) {
    els.copyLinkBtn.addEventListener('click', async () => {
      const state = readState();
      const url = getShareBaseUrl();
      url.search = stateToQueryParams(state).toString();
      const link = url.toString();
      const ok = await copyText(link);
      if (ok) {
        showToast('Shareable link copied');
      } else {
        showToast('Could not copy automatically — link shown');
        // Last resort: show a selectable prompt (may still be blocked on some browsers).
        window.prompt('Copy this link:', link);
      }
    });
  }

  if (els.copySummaryBtn) {
    els.copySummaryBtn.addEventListener('click', async () => {
      const state = readState();
      const out = compute(state);
      const single = out.single;
      const planName =
        state.planType === 'ANNUAL_UPFRONT'
          ? 'Premium (annual upfront)'
          : state.planType === 'ANNUAL_INSTALLMENTS'
            ? 'Premium (instalments)'
            : 'Standard (monthly)';
      const target = state.outcomeMode === 'CUSTOM' ? state.customTarget : TYPICAL_TARGET_GBP;

      const lines = [
        'CoderCo ROI estimate',
        `Current salary: ${Number.isFinite(state.currentSalary) ? `£${Math.round(state.currentSalary).toLocaleString()}` : '—'}`,
        `Modelled target salary: ${Number.isFinite(target) ? `£${Math.round(target).toLocaleString()}` : '—'} (after ${Math.round(state.monthsToOutcome)} months)`,
        `Plan: ${planName}`,
        `Estimated total investment: £${Math.round(single.totalCostGbp).toLocaleString()}`,
        `Payback time (after salary increase): ${single.paybackAfterTarget === null ? '—' : formatMonths(single.paybackAfterTarget)}`,
        `Break-even from today: ${single.breakEvenFromToday === null ? '—' : formatMonths(single.breakEvenFromToday)}`,
        '',
        'Note: Educational estimate only. No guaranteed outcomes.',
      ].join('\n');

      const ok = await copyText(lines);
      if (ok) {
        showToast('Summary copied');
      } else {
        showToast('Could not copy automatically — summary shown');
        window.prompt('Copy summary:', lines);
      }
    });
  }
}

(function init() {
  setDefaults();
  const loaded = loadStateFromUrl();
  wireEvents();
  render();
  if (loaded) showToast('Loaded from shared link');
})();
