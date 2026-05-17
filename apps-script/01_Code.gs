var CONFIG = {
  SPREADSHEET_ID: "1FZfeuBkjcEwOACP5E5DtMueOv8DqgdN_8yxHiu7SLsE",
  HOME_SHEET: "ホーム",
  API_PRICE_SHEET: "API価格取得・評価額",
  WATCH_SUMMARY_SHEET: "監視集計",
  WEEKLY_REVIEW_SHEET: "週次レビュー",
  SNAPSHOT_SHEET: "日次資産スナップショット",
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
    chart: getChartMeta_(ss),
    lastFetchedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
  };
}

function getChartMeta_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SNAPSHOT_SHEET);
  if (!sheet) {
    return {
      count: 0,
      latestDate: "",
      firstDate: "",
      latestTotalAsset: "",
      latestGainAmount: "",
      latestGainRate: ""
    };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      count: 0,
      latestDate: "",
      firstDate: "",
      latestTotalAsset: "",
      latestGainAmount: "",
      latestGainRate: ""
    };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 15).getDisplayValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    if (values[i][0]) rows.push(values[i]);
  }

  if (rows.length === 0) {
    return {
      count: 0,
      latestDate: "",
      firstDate: "",
      latestTotalAsset: "",
      latestGainAmount: "",
      latestGainRate: ""
    };
  }

  var latest = rows[rows.length - 1];
  var first = rows[0];

  return {
    count: rows.length,
    latestDate: latest[0] || "",
    firstDate: first[0] || "",
    latestTotalAsset: latest[3] || "",
    latestGainAmount: latest[5] || "",
    latestGainRate: latest[6] || ""
  };
}

function getSnapshots_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SNAPSHOT_SHEET);
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
      dateKey: normalizeDateKey_(r[0]),
      totalValue: toNumber_(r[1]),
      cash: toNumber_(r[2]),
      totalAsset: toNumber_(r[3]),
      trueCapital: toNumber_(r[4]),
      gainAmount: toNumber_(r[5]),
      gainRate: toNumber_(r[6]),
      jpValue: toNumber_(r[7]),
      usValue: toNumber_(r[8]),
      fundValue: toNumber_(r[9]),
      holdingCount: toNumber_(r[10]),
      watchCount: toNumber_(r[11]),
      simTotalValue: toNumber_(r[12]),
      simTotalGain: toNumber_(r[13]),
      memo: r[14] || ""
    });
  }

  return out;
}

function toNumber_(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && isFinite(value)) return value;

  var n = Number(String(value).replace(/,/g, ""));
  return isFinite(n) ? n : "";
}

function normalizeDateKey_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy/MM/dd");
  }

  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    text = text.substring(0, 10).replace(/-/g, "/");
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    var parts = text.split("/");
    return [
      parts[0],
      ("0" + parts[1]).slice(-2),
      ("0" + parts[2]).slice(-2)
    ].join("/");
  }

  return text;
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
