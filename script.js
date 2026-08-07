"use strict";

const DAYS_IN_YEAR = 365.2425;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "bond-theme";
const PURCHASE_MODE_STORAGE_KEY = "bond-purchase-mode";

function getStoredTheme() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

function getStoredPurchaseMode() {
  try {
    const mode = localStorage.getItem(PURCHASE_MODE_STORAGE_KEY);
    return mode === "quantity" || mode === "amount" ? mode : null;
  } catch {
    return null;
  }
}

function savePurchaseMode(mode) {
  try {
    localStorage.setItem(PURCHASE_MODE_STORAGE_KEY, mode);
  } catch {
    // Выбранный режим всё равно применяется в текущей вкладке.
  }
}

function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme, toggle) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
  toggle.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
}

function initThemeToggle() {
  const toggle = document.querySelector("#theme-toggle");
  const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
  let hasManualChoice = getStoredTheme() !== null;
  const initialTheme = document.documentElement.dataset.theme || getStoredTheme() || getSystemTheme();

  applyTheme(initialTheme, toggle);

  toggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    hasManualChoice = true;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Тема всё равно переключится в текущей вкладке.
    }

    applyTheme(nextTheme, toggle);
  });

  systemTheme?.addEventListener("change", (event) => {
    if (!hasManualChoice) {
      applyTheme(event.matches ? "dark" : "light", toggle);
    }
  });
}

function pluralizeRu(value, forms) {
  const normalized = Math.abs(value) % 100;
  const lastDigit = normalized % 10;

  if (normalized > 10 && normalized < 20) {
    return forms[2];
  }

  if (lastDigit === 1) {
    return forms[0];
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }

  return forms[2];
}

function formatHoldingPeriod(holdingYears) {
  const nearestWholeYear = Math.round(holdingYears);
  const distanceToWholeYearInDays = Math.abs(holdingYears - nearestWholeYear) * DAYS_IN_YEAR;

  if (distanceToWholeYearInDays < 0.5) {
    return `${nearestWholeYear} ${pluralizeRu(nearestWholeYear, ["год", "года", "лет"])}`;
  }

  let years = Math.floor(holdingYears);
  const averageDaysInMonth = DAYS_IN_YEAR / 12;
  const remainingDays = Math.round((holdingYears - years) * DAYS_IN_YEAR);
  let months = Math.floor(remainingDays / averageDaysInMonth);
  let days = Math.round(remainingDays - months * averageDaysInMonth);

  if (days >= Math.round(averageDaysInMonth)) {
    months += 1;
    days = 0;
  }

  if (months >= 12) {
    years += 1;
    months -= 12;
  }

  const parts = [];

  if (years > 0) {
    parts.push(`${years} ${pluralizeRu(years, ["год", "года", "лет"])}`);
  }

  if (months > 0) {
    parts.push(`${months} ${pluralizeRu(months, ["месяц", "месяца", "месяцев"])}`);
  }

  if (days > 0) {
    parts.push(`${days} ${pluralizeRu(days, ["день", "дня", "дней"])}`);
  }

  return parts.join(" ") || "0 дней";
}

function combineHoldingPeriod(years, months) {
  return years + months / 12;
}

function toKopecks(value) {
  return Math.round((value + Number.EPSILON) * 100);
}

function calculatePurchasableQuantity(investmentAmount, purchasePrice) {
  if (
    !Number.isFinite(investmentAmount) ||
    !Number.isFinite(purchasePrice) ||
    investmentAmount <= 0 ||
    purchasePrice <= 0
  ) {
    return 0;
  }

  return Math.floor(toKopecks(investmentAmount) / toKopecks(purchasePrice));
}

function calculateInvestmentAmount(purchasePrice, quantity) {
  if (!Number.isFinite(purchasePrice) || !Number.isInteger(quantity) || quantity < 0) {
    return 0;
  }

  return (toKopecks(purchasePrice) * quantity) / 100;
}

function calculateInvestmentRemainder(investmentAmount, purchasePrice, quantity) {
  if (
    !Number.isFinite(investmentAmount) ||
    !Number.isFinite(purchasePrice) ||
    !Number.isInteger(quantity) ||
    investmentAmount < 0 ||
    purchasePrice <= 0 ||
    quantity < 0
  ) {
    return null;
  }

  const remainderInKopecks =
    toKopecks(investmentAmount) - toKopecks(purchasePrice) * quantity;

  return remainderInKopecks >= 0 ? remainderInKopecks / 100 : null;
}

/**
 * Рассчитывает купонную доходность и отдельный результат от цены выхода.
 * Все денежные значения относятся к одной облигации, кроме результатов.
 */
function calculateBond({
  nominal,
  purchasePrice,
  quantity,
  coupon,
  paymentsPerYear,
  holdingYears,
  exitPrice,
}) {
  const investment = calculateInvestmentAmount(purchasePrice, quantity);
  const annualCoupons = coupon * paymentsPerYear * quantity;
  const priceDifference = (exitPrice - purchasePrice) * quantity;
  const annualIncome = annualCoupons;
  const annualYield = (annualIncome / investment) * 100;
  const couponIncomeTotal = annualCoupons * holdingYears;
  const totalProfit = couponIncomeTotal + priceDifference;
  const finalAmount = investment + totalProfit;

  return {
    nominal,
    quantity,
    investment,
    annualCoupons,
    priceDifference,
    annualIncome,
    annualYield,
    couponIncomeTotal,
    totalProfit,
    finalAmount,
    holdingYears,
  };
}

function initCalculator() {
  const form = document.querySelector("#bond-form");
  const purchaseModeRadios = document.querySelectorAll('input[name="purchaseMode"]');
  const holdRadios = document.querySelectorAll('input[name="holdToMaturity"]');
  const purchasePriceInput = document.querySelector("#purchase-price");
  const quantityInput = document.querySelector("#quantity");
  const investmentAmountInput = document.querySelector("#investment-amount");
  const purchaseRemainder = document.querySelector("#purchase-remainder");
  const purchaseRemainderValue = document.querySelector("#purchase-remainder-value");
  const maturityFields = document.querySelector("#maturity-fields");
  const saleFields = document.querySelector("#sale-fields");
  const maturityDate = document.querySelector("#maturity-date");
  const holdingYears = document.querySelector("#holding-years");
  const holdingMonths = document.querySelector("#holding-months");
  const salePrice = document.querySelector("#sale-price");
  const formError = document.querySelector("#form-error");
  const emptyResults = document.querySelector("#empty-results");
  const calculatedResults = document.querySelector("#calculated-results");
  const scenarioLabel = document.querySelector("#scenario-label");

  const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const percentFormatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const quantityFormatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  });

  function toLocalDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function setDateDefaults() {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const defaultMaturity = new Date();
    defaultMaturity.setHours(0, 0, 0, 0);
    defaultMaturity.setFullYear(defaultMaturity.getFullYear() + 5);

    maturityDate.min = toLocalDateInputValue(tomorrow);
    maturityDate.value = toLocalDateInputValue(defaultMaturity);
  }

  function isHoldingToMaturity() {
    return document.querySelector('input[name="holdToMaturity"]:checked').value === "yes";
  }

  function isPurchaseByAmount() {
    return document.querySelector('input[name="purchaseMode"]:checked').value === "amount";
  }

  function formatInputMoney(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    return String(Number(value.toFixed(2)));
  }

  function syncPurchaseFields() {
    const purchaseByAmount = isPurchaseByAmount();
    const purchasePrice = Number(purchasePriceInput.value);

    quantityInput.readOnly = purchaseByAmount;
    investmentAmountInput.readOnly = !purchaseByAmount;
    quantityInput.required = !purchaseByAmount;
    investmentAmountInput.required = purchaseByAmount;
    purchaseRemainder.hidden = !purchaseByAmount;

    if (purchaseByAmount) {
      const investmentAmount = Number(investmentAmountInput.value);
      const quantity =
        Number.isFinite(investmentAmount) && investmentAmount > 0 && purchasePrice > 0
          ? calculatePurchasableQuantity(investmentAmount, purchasePrice)
          : null;
      const remainder =
        quantity !== null && quantity >= 1
          ? calculateInvestmentRemainder(investmentAmount, purchasePrice, quantity)
          : null;

      quantityInput.value = quantity === null ? "" : String(quantity);
      purchaseRemainderValue.textContent =
        remainder === null ? "—" : currencyFormatter.format(remainder);
      return;
    }

    purchaseRemainderValue.textContent = "—";

    const quantity = Number(quantityInput.value);
    investmentAmountInput.value =
      Number.isInteger(quantity) && quantity > 0 && purchasePrice > 0
        ? formatInputMoney(calculateInvestmentAmount(purchasePrice, quantity))
        : "";
  }

  function updateScenarioFields() {
    const holdToMaturity = isHoldingToMaturity();

    maturityFields.hidden = !holdToMaturity;
    saleFields.hidden = holdToMaturity;
    maturityDate.required = holdToMaturity;
    holdingYears.required = !holdToMaturity;
    holdingMonths.required = !holdToMaturity;
    salePrice.required = !holdToMaturity;
    scenarioLabel.textContent = holdToMaturity ? "До погашения" : "Продажа";
    formError.textContent = "";

    for (const input of form.querySelectorAll('[aria-invalid="true"]')) {
      input.removeAttribute("aria-invalid");
    }
  }

  function parseNumber(selector) {
    return Number(document.querySelector(selector).value);
  }

  function calculateHoldingYears() {
    if (!isHoldingToMaturity()) {
      return combineHoldingPeriod(Number(holdingYears.value), Number(holdingMonths.value));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(`${maturityDate.value}T00:00:00`);
    return (endDate.getTime() - today.getTime()) / (MILLISECONDS_IN_DAY * DAYS_IN_YEAR);
  }

  function markInvalid(input, message) {
    input.setAttribute("aria-invalid", "true");
    formError.textContent = message;
    input.focus();
  }

  function validate(values) {
    const standardFields = [
      ["#nominal", values.nominal, "Введите номинал больше нуля"],
      ["#purchase-price", values.purchasePrice, "Введите цену облигации больше нуля"],
      ["#payments-per-year", values.paymentsPerYear, "Введите целое количество выплат в год"],
    ];

    for (const [selector, value, message] of standardFields) {
      const input = document.querySelector(selector);
      const mustBeInteger = selector === "#payments-per-year";
      if (!Number.isFinite(value) || value <= 0 || (mustBeInteger && !Number.isInteger(value))) {
        markInvalid(input, message);
        return false;
      }
    }

    if (values.purchaseByAmount) {
      if (!Number.isFinite(values.investmentAmount) || values.investmentAmount <= 0) {
        markInvalid(investmentAmountInput, "Введите сумму вложения больше нуля");
        return false;
      }

      if (!Number.isInteger(values.quantity) || values.quantity < 1) {
        markInvalid(
          investmentAmountInput,
          "Этой суммы недостаточно для покупки хотя бы одной облигации",
        );
        return false;
      }
    } else if (!Number.isInteger(values.quantity) || values.quantity < 1) {
      markInvalid(quantityInput, "Введите целое количество облигаций");
      return false;
    }

    const couponInput = document.querySelector("#coupon");
    if (!Number.isFinite(values.coupon) || values.coupon < 0) {
      markInvalid(couponInput, "Купон не может быть отрицательным");
      return false;
    }

    if (!isHoldingToMaturity()) {
      const yearsValue = Number(holdingYears.value);
      const monthsValue = Number(holdingMonths.value);

      if (!Number.isInteger(yearsValue) || yearsValue < 0) {
        markInvalid(holdingYears, "Количество лет должно быть целым неотрицательным числом");
        return false;
      }

      if (!Number.isInteger(monthsValue) || monthsValue < 0 || monthsValue > 11) {
        markInvalid(holdingMonths, "Количество месяцев должно быть целым числом от 0 до 11");
        return false;
      }
    }

    if (!Number.isFinite(values.holdingYears) || values.holdingYears <= 0) {
      markInvalid(
        isHoldingToMaturity() ? maturityDate : holdingYears,
        isHoldingToMaturity()
          ? "Дата погашения должна быть позже сегодняшней"
          : "Введите срок владения больше нуля",
      );
      return false;
    }

    if (!Number.isFinite(values.exitPrice) || values.exitPrice <= 0) {
      markInvalid(salePrice, "Введите ожидаемую цену продажи больше нуля");
      return false;
    }

    return true;
  }

  function setSignedValue(element, value) {
    element.textContent = currencyFormatter.format(value);
    element.classList.toggle("positive-value", value > 0);
    element.classList.toggle("negative-value", value < 0);
  }

  function renderResults(result) {
    emptyResults.hidden = true;
    calculatedResults.hidden = false;

    const yieldRow = document.querySelector(".yield-row");
    const isLoss = result.annualIncome < 0;
    yieldRow.classList.toggle("loss", isLoss);

    document.querySelector("#annual-yield").textContent = `${percentFormatter.format(result.annualYield)}%`;
    setSignedValue(document.querySelector("#annual-income"), result.annualIncome);
    document.querySelector("#final-amount").textContent = currencyFormatter.format(result.finalAmount);
    document.querySelector("#investment").textContent = currencyFormatter.format(result.investment);
    document.querySelector("#result-quantity").textContent = `${quantityFormatter.format(result.quantity)} шт.`;
    document.querySelector("#holding-period").textContent = formatHoldingPeriod(result.holdingYears);
    setSignedValue(document.querySelector("#price-result"), result.priceDifference);
    setSignedValue(document.querySelector("#coupon-income-total"), result.couponIncomeTotal);
    setSignedValue(document.querySelector("#total-income"), result.totalProfit);
  }

  function handleSubmit(event) {
    event.preventDefault();
    formError.textContent = "";

    for (const input of form.querySelectorAll('[aria-invalid="true"]')) {
      input.removeAttribute("aria-invalid");
    }

    syncPurchaseFields();

    const holdToMaturity = isHoldingToMaturity();
    const purchaseByAmount = isPurchaseByAmount();
    const values = {
      nominal: parseNumber("#nominal"),
      purchasePrice: parseNumber("#purchase-price"),
      quantity: parseNumber("#quantity"),
      investmentAmount: parseNumber("#investment-amount"),
      purchaseByAmount,
      coupon: parseNumber("#coupon"),
      paymentsPerYear: parseNumber("#payments-per-year"),
      holdingYears: calculateHoldingYears(),
      exitPrice: holdToMaturity ? parseNumber("#nominal") : Number(salePrice.value),
    };

    if (!validate(values)) {
      return;
    }

    renderResults(calculateBond(values));
  }

  setDateDefaults();
  updateScenarioFields();

  const storedPurchaseMode = getStoredPurchaseMode();
  const storedPurchaseModeRadio = Array.from(purchaseModeRadios).find(
    (radio) => radio.value === storedPurchaseMode,
  );

  if (storedPurchaseModeRadio) {
    storedPurchaseModeRadio.checked = true;
  }

  syncPurchaseFields();

  for (const radio of purchaseModeRadios) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        savePurchaseMode(radio.value);
      }
      syncPurchaseFields();
      quantityInput.removeAttribute("aria-invalid");
      investmentAmountInput.removeAttribute("aria-invalid");
      formError.textContent = "";
    });
  }

  for (const radio of holdRadios) {
    radio.addEventListener("change", updateScenarioFields);
  }

  purchasePriceInput.addEventListener("input", syncPurchaseFields);
  quantityInput.addEventListener("input", () => {
    if (!isPurchaseByAmount()) {
      syncPurchaseFields();
    }
  });
  investmentAmountInput.addEventListener("input", () => {
    if (isPurchaseByAmount()) {
      syncPurchaseFields();
    }
  });

  for (const input of form.querySelectorAll("input")) {
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      formError.textContent = "";
    });
  }

  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches('input:not([type="radio"])')) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", handleSubmit);
}

if (typeof document !== "undefined") {
  initThemeToggle();
  initCalculator();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateBond,
    calculateInvestmentRemainder,
    calculatePurchasableQuantity,
    combineHoldingPeriod,
    formatHoldingPeriod,
  };
}
