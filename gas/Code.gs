var CONFIG = {
  SPREADSHEET_ID: "1FZfeuBkjcEwOACP5E5DtMueOv8DqgdN_8yxHiu7SLsE",
  HOME_SHEET: "ホーム",
  API_PRICE_SHEET: "API価格取得・評価額",
  WATCH_SUMMARY_SHEET: "監視集計",
  WEEKLY_REVIEW_SHEET: "週次レビュー",
  LIFF_ID: "2010108717-qrydg64H"
};

function doGet() {
  var e = arguments[0] || {};

  if (e.parameter && e.parameter.api === "portfolio") {
    return createPortfolioApiResponse_(e.parameter.callback);
  }

  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("株ポートフォリオ")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppConfig_() {
  return {
    liffId: CONFIG.LIFF_ID
  };
}

function getPortfolioAppData() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  return {
    config: getAppConfig_(),
    home: getHomeSummary_(ss),
    holdings: getCurrentHoldings_(ss),
    watchlist: getWatchlist_(ss),
    weekly: getWeeklyReview_(ss),
    lastFetchedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
  };
}

function createPortfolioApiResponse_(callback) {
  var payload = getPortfolioAppData();
  var body = callback
    ? String(callback) + "(" + JSON.stringify(payload) + ");"
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function getHomeSummary_(ss) {
  var sheet = ss.getSheetByName(CONFIG.HOME_SHEET);
  if (!sheet) return {};

  return {
    updatedAt: getDisplayValue_(sheet, "B4"),
    totalAsset: getDisplayValue_(sheet, "B5"),
    trueCapital: getDisplayValue_(sheet, "D5"),
    gainAmount: getDisplayValue_(sheet, "F5"),
    gainRate: getDisplayValue_(sheet, "H5"),
    holdingCount: getDisplayValue_(sheet, "B8"),
    maxWeight: getDisplayValue_(sheet, "D8"),
    note: getDisplayValue_(sheet, "B11")
  };
}

function getCurrentHoldings_(ss) {
  var sheet = ss.getSheetByName(CONFIG.API_PRICE_SHEET);
  if (!sheet) return [];

  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r[14] !== "現在保有") continue;
    rows.push({
      broker: r[0],
      code: r[1],
      name: r[2],
      qty: r[3],
      type: r[4],
      priceJpy: r[9],
      valueJpy: r[10],
      memo: r[13]
    });
  }

  return rows;
}

function getWatchlist_(ss) {
  var sheet = ss.getSheetByName(CONFIG.WATCH_SUMMARY_SHEET);
  if (!sheet) return [];

  var values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 20).getDisplayValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    rows.push({
      name: r[0],
      code: r[1],
      currentPrice: r[2],
      startDate: r[3],
      startPrice: r[4],
      changeRate: r[5],
      targetBudget: r[6],
      estimatedQty: r[7],
      currentValue: r[8],
      diff: r[9],
      theme: r[10],
      manualHint: r[11],
      autoJudge: r[17] || "",
      reviewPoint: r[19] || ""
    });
  }

  return rows;
}

function getWeeklyReview_(ss) {
  var sheet = ss.getSheetByName(CONFIG.WEEKLY_REVIEW_SHEET);
  if (!sheet) return {};

  return {
    updatedAt: getDisplayValue_(sheet, "B2"),
    watchCount: getDisplayValue_(sheet, "D2"),
    dipCount: getDisplayValue_(sheet, "F2"),
    themes: readTable_(sheet, 6, 1, 3),
    candidates: readTable_(sheet, 25, 1, 6),
    budgets: readTable_(sheet, 48, 1, 6),
    memo: getDisplayValue_(sheet, "A67")
  };
}

function readTable_(sheet, startRow, startCol, width) {
  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) return [];

  var values = sheet.getRange(startRow, startCol, lastRow - startRow + 1, width).getDisplayValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) break;
    rows.push(row);
  }

  return rows;
}

function getDisplayValue_(sheet, a1) {
  return sheet.getRange(a1).getDisplayValue();
}
