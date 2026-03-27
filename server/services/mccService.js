/**
 * mccService.js
 * Validates whether a transaction is permitted under a PIN's MCC and geo restrictions.
 *
 * MCC = Merchant Category Code — a 4-digit number assigned to every merchant
 * by card networks (Visa/MC). These map directly to the categories your
 * UI lets users select when creating a PinWay.
 */

// Map of category IDs (used in UI) to sets of MCC codes
const MCC_MAP = {
  groceries:  ["5411", "5412", "5422", "5441", "5451", "5462", "5499"],
  gas:        ["5541", "5542", "5552", "5172"],
  pharmacy:   ["5912", "5122"],
  restaurants:["5812", "5813", "5814", "5411"],
  hotels:     ["7011", "7012", "3501", "3502"],
  transport:  ["4111", "4112", "4121", "4131", "7512", "4411"],
  atm:        ["6011", "6012"],
  medical:    ["8011", "8021", "8031", "8041", "8049", "8099"],
  clothing:   ["5621", "5651", "5661", "5699", "5611"],
  utilities:  ["4900", "4911", "4931", "4941", "4961", "4971"],
  education:  ["8211", "8220", "8249", "8299", "5942", "5945"],
  hardware:   ["5251", "5261", "5712", "5719"],
};

// Hardcoded blocked MCCs (alcohol, gambling, tobacco, adult)
const ALWAYS_BLOCKED_MCCS = new Set([
  "5921", // Liquor stores
  "7995", // Gambling / betting
  "5993", // Tobacco
  "5994", // Newsagents (often carry tobacco)
  "7273", // Dating/escort services
  "7297", // Massage parlors
]);

// Geographic region definitions (ISO country codes)
const GEO_REGIONS = {
  us:    ["US"],
  latam: ["US","MX","GT","BZ","HN","SV","NI","CR","PA","CO","VE","EC","PE","BO","PY","UY","CL","AR","BR","GY","SR"],
  eu:    ["US","GB","DE","FR","IT","ES","NL","BE","AT","CH","SE","NO","DK","FI","PL","CZ","HU","RO","PT","GR","IE"],
  any:   null, // null means worldwide — no restriction
};

/**
 * Check whether a transaction should be approved.
 *
 * @param {object} params
 * @param {string}   params.mccCode         4-digit MCC of the merchant
 * @param {string}   params.countryCode      ISO-2 country code where the charge occurs
 * @param {number}   params.amount           Transaction amount
 * @param {number}   params.perTxLimit       Per-transaction limit on the PIN
 * @param {number}   params.dailyLimit       Daily spend limit on the PIN
 * @param {number}   params.dailySpent       Amount already spent today
 * @param {string[]} params.allowedCategories Array of category IDs (e.g. ["groceries","gas"])
 * @param {string}   params.geoRestriction   One of: "us" | "latam" | "eu" | "any"
 * @param {number}   params.remainingBalance Remaining balance on the PIN
 * @param {number}   params.usesLeft         Uses remaining before PIN is exhausted
 *
 * @returns {{ approved: boolean, reason: string|null }}
 */
function evaluateTransaction({
  mccCode,
  countryCode,
  amount,
  perTxLimit,
  dailyLimit,
  dailySpent,
  allowedCategories,
  geoRestriction,
  remainingBalance,
  usesLeft,
}) {
  // 1. Always-blocked MCC check
  if (ALWAYS_BLOCKED_MCCS.has(mccCode)) {
    return { approved: false, reason: "Merchant type blocked" };
  }

  // 2. Uses remaining
  if (usesLeft <= 0) {
    return { approved: false, reason: "PIN use limit reached" };
  }

  // 3. Balance check
  if (amount > remainingBalance) {
    return { approved: false, reason: "Insufficient PIN balance" };
  }

  // 4. Per-transaction limit
  if (amount > perTxLimit) {
    return { approved: false, reason: "Exceeds per-transaction limit" };
  }

  // 5. Daily limit
  if (dailySpent + amount > dailyLimit) {
    return { approved: false, reason: "Daily spending limit reached" };
  }

  // 6. MCC category restriction
  const allowedMccs = new Set(
    allowedCategories.flatMap((cat) => MCC_MAP[cat] || [])
  );
  if (!allowedMccs.has(mccCode)) {
    return { approved: false, reason: "MCC restricted" };
  }

  // 7. Geographic restriction
  const allowedCountries = GEO_REGIONS[geoRestriction];
  if (allowedCountries !== null && !allowedCountries.includes(countryCode)) {
    return { approved: false, reason: "Geo restriction" };
  }

  return { approved: true, reason: null };
}

/**
 * Resolve an MCC code to a category ID (reverse lookup).
 * @param {string} mccCode
 * @returns {string|null} Category ID or null if not mapped
 */
function mccToCategory(mccCode) {
  for (const [category, codes] of Object.entries(MCC_MAP)) {
    if (codes.includes(mccCode)) return category;
  }
  return null;
}

module.exports = { evaluateTransaction, mccToCategory, MCC_MAP, GEO_REGIONS };
