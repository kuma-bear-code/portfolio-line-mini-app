var CONFIG = {
  SPREADSHEET_ID: "1FZfeuBkjcEwOACP5E5DtMueOv8DqgdN_8yxHiu7SLsE",
  HOME_SHEET: "ホーム",
  API_PRICE_SHEET: "API価格取得・評価額",
  WATCH_SUMMARY_SHEET: "監視集計",
  WEEKLY_REVIEW_SHEET: "週次レビュー",
  LIFF_ID: "2010108717-qrydg64H"
};

function doGet(e) {
  e = e || {};

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
    snapshots: getSnapshots_(ss),
    lastFetchedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
  };
}

function getSnapshots_(ss) {
  var sheet = ss.getSheetByName("日次資産スナップショット");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, 15).getDisplayValues();
  var out = [];
  var start = Math.max(0, rows.length - 365);

  for (var i = start; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;

    out.push({
      date: r[0],
      totalValue: r[1],
      cash: r[2],
      totalAsset: r[3],
      trueCapital: r[4],
      gainAmount: r[5],
      gainRate: r[6],
      jpValue: r[7],
      usValue: r[8],
      fundValue: r[9],
      holdingCount: r[10],
      watchCount: r[11],
      simTotalValue: r[12],
      simTotalGain: r[13],
      memo: r[14]
    });
  }

  return out;
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
