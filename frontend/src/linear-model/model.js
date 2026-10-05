// [PREDICTIVE ANALYTICS] Resulta ng statistician (RESULT.docx) - linear regression ng sales history,
// Nov 2021 hanggang Aug 2026. Palitan lang ang laman nito kapag may bagong resulta ang statistician.

// Monthly Linear Regression - Product Performance: Benta = constant + B x t, kung saan t = 1 ang Nov 2021.
// Ito ang ginagamit ng dashboard sa paghula ng benta bawat buwan.
export const STATISTICIAN_MONTHLY_SALES_MODEL = {
  firstMonth: { year: 2021, month: 10 }, // t = 1 (Nov 2021; 0 = Jan)
  constant: 37096.91,
  // Eksaktong B; -23.52 sa dokumento (naka-round). Sa eksakto, tumatama ang Sep 2026 sa ₱35,709.50.
  slope: -23.5153,
  predicts: { year: 2026, month: 8 }, // Sep 2026 ang hinulaan ng statistician (t = 59)
};

// Weekly Linear Regression - Product Performance: Benta = constant + B x t, kung saan t = 1 ang linggo ng Nov 1, 2021.
export const STATISTICIAN_WEEKLY_SALES_MODEL = {
  firstWeekStart: '2021-11-01T00:00:00',
  constant: 8605.66,
  // Eksaktong B; -2.05 sa dokumento (naka-round). Sa eksakto, tumatama ang linggo ng Sep 7 sa ₱8,085.14.
  slope: -2.0493,
  predicts: '2026-09-07T00:00:00', // linggo ng Sep 7, 2026 ang hinulaan ng statistician (t = 254)
};

// Yearly Linear Regression - Product Performance: Benta = constant + B x taon (hal. 2027).
// Paalala: 2 buwan lang ang 2021 at 8 buwan ang 2026 sa data, kaya mukhang mas malakas ang pagtaas.
// Eksaktong B (28,655.0286) ang gamit: ang naka-round na 28,655.03 ay lumalayo ng ~₱3 kapag pinarami sa 2027.
export const STATISTICIAN_YEARLY_SALES_MODEL = {
  constant: -57631552.65,
  slope: 28655.0286,
  predicts: 2027, // 2027 ang hinulaan ng statistician
};

// [PREDICTIVE ANALYTICS] Customer Purchase Pattern: bilang ng orders = constant + B x t (galing sa
// training/trained_model.json). Pareho ang t ng sales models: taon, buwan (Nov 2021 = 1), linggo (Nov 1, 2021 = 1).
export const STATISTICIAN_MONTHLY_ORDERS_MODEL = {
  firstMonth: { year: 2021, month: 10 },
  constant: 42.80036,
  slope: 0.00092282, // Sep 2026 (t = 59) = 42.85 orders
};
export const STATISTICIAN_WEEKLY_ORDERS_MODEL = {
  firstWeekStart: '2021-11-01T00:00:00',
  constant: 9.93008,
  slope: -0.00088107, // linggo ng Sep 7, 2026 (t = 254) = 9.71 orders
};
export const STATISTICIAN_YEARLY_ORDERS_MODEL = {
  constant: -73357.0286,
  slope: 36.457143, // 2027 = 541.60 orders
};

export const STATISTICIAN_RESULTS = [
  {
    level: 'Yearly',
    measure: 'Product performance (sales)',
    observations: '6 years',
    r: 0.356, r2: 0.126, adjR2: -0.092, f: 'F(1,4) = 0.579', p: 0.489,
    slope: '+₱28,655.03 / year', constant: '-₱57,631,552.65',
    prediction: { label: '2027', value: '₱452,190.27' },
    meaning: 'Weak upward trend that is not significant. Explains only 12.6% of the change in yearly sales.',
    partialYears: true,
  },
  {
    level: 'Yearly',
    measure: 'Customer purchase patterns (orders)',
    observations: '6 years',
    r: 0.390, r2: 0.152, adjR2: -0.060, f: 'F(1,4) = 0.716', p: 0.445,
    slope: '+36.46 orders / year', constant: '-73,357.03',
    prediction: { label: '2027', value: '541.60 orders' },
    meaning: 'Weak upward trend that is not significant. Time alone does not explain the yearly number of orders.',
    partialYears: true,
  },
  {
    level: 'Monthly',
    measure: 'Product performance (sales)',
    observations: '58 months',
    r: 0.085, r2: 0.007, adjR2: -0.011, f: 'F(1,56) = 0.403', p: 0.528,
    slope: '-₱23.52 / month', constant: '₱37,096.91',
    prediction: { label: 'Sep 2026', value: '₱35,709.50' },
    meaning: 'Sales are basically flat: a very small, non-significant drop of about ₱23.52 a month.',
  },
  {
    level: 'Monthly',
    measure: 'Customer purchase patterns (orders)',
    observations: '58 months',
    r: 0.013, r2: 0.0002, adjR2: -0.018, f: 'F(1,56) = 0.009', p: 0.926,
    slope: '+0.001 order / month', constant: '42.80',
    prediction: { label: 'Sep 2026', value: '42.85 orders' },
    meaning: 'Orders stay steady at about 43 a month; there is no trend over time.',
  },
  {
    level: 'Weekly',
    measure: 'Product performance (sales)',
    observations: '253 weeks',
    r: 0.069, r2: 0.005, adjR2: 0.001, f: 'F(1,251) = 1.187', p: 0.277,
    slope: '-₱2.05 / week', constant: '₱8,605.66',
    prediction: { label: 'Week of Sep 7, 2026', value: '₱8,085.14' },
    meaning: 'Weekly sales are stable; the small drop of ₱2.05 a week is not significant.',
  },
  {
    level: 'Weekly',
    measure: 'Customer purchase patterns (orders)',
    observations: '253 weeks',
    r: 0.098, r2: 0.010, adjR2: 0.006, f: 'F(1,251) = 2.421', p: 0.121,
    slope: '-0.001 order / week', constant: '9.93',
    prediction: { label: 'Week of Sep 7, 2026', value: '9.71 orders' },
    meaning: 'About 10 orders a week; buying is stable and not driven by time.',
  },
];

export const SIGNIFICANCE_LEVEL = 0.05;

// [PREDICTIVE ANALYTICS] Ang data na ginamit ng statistician (BOCOFAC_SALES_DATA_2026_FINAL.xlsx, sheet "Sales Data"):
// 2,484 benta, ₱2,111,386, Nov 1 2021 hanggang Aug 31 2026. Sa panahong ito, ang sales history lang ang binibilang
// sa analytics para tumugma sa resulta ng statistician; ang mga benta pagkatapos nito ay kasama na rin.
export const STATISTICIAN_DATASET = {
  from: '2021-11-01',
  to: '2026-08-31',
  orders: 2484,
  totalSales: 2111386,
};
