var CONFIG = {
  SPREADSHEET_ID: "1FZfeuBkjcEwOACP5E5DtMueOv8DqgdN_8yxHiu7SLsE",
  HOME_SHEET: "\u30db\u30fc\u30e0",
  API_PRICE_SHEET: "API\u4fa1\u683c\u53d6\u5f97\u30fb\u8a55\u4fa1\u984d",
  WATCH_SUMMARY_SHEET: "\u76e3\u8996\u96c6\u8a08",
  WEEKLY_REVIEW_SHEET: "\u9031\u6b21\u30ec\u30d3\u30e5\u30fc",
  SNAPSHOT_SHEET: "\u65e5\u6b21\u8cc7\u7523\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8",
  LIFF_ID: "2010108717-qrydg64H"
};

function doGet(e) {
  e = e || {};

  if (e.parameter && e.parameter.api === "portfolio") {
    return createPortfolioApiResponse_(e.parameter.callback);
  }

  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("\u682a\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa")
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
    insights: getSnapshotInsights_(ss),
    lastFetchedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss")
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

function getChartMeta_(ss) {
  var snapshots = getSnapshots_(ss);

  if (!snapshots.length) {
    return {
      count: 0,
      latestDate: "",
      firstDate: "",
      latestTotalAsset: "",
      latestGainAmount: "",
      latestGainRate: ""
    };
  }

  var latest = snapshots[snapshots.length - 1];
  var first = snapshots[0];

  return {
    count: snapshots.length,
    latestDate: latest.date || "",
    firstDate: first.date || "",
    latestTotalAsset: latest.totalAsset,
    latestGainAmount: latest.gainAmount,
    latestGainRate: latest.gainRate
  };
}

function getSnapshotInsights_(ss) {
  var snapshots = getSnapshots_(ss);
  var alerts = [];

  if (!snapshots.length) {
    return {
      latest: null,
      previousDay: null,
      previousWeek: null,
      dailyChange: "",
      dailyChangeRate: "",
      weeklyChange: "",
      weeklyChangeRate: "",
      alerts: [
        {
          level: "info",
          title: "No snapshot data yet",
          body: "Daily snapshots will appear after the next update."
        }
      ]
    };
  }

  var latest = snapshots[snapshots.length - 1];
  var previousDay = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  var previousWeek = findSnapshotBeforeDays_(snapshots, latest.dateKey, 7);

  var dailyChange = previousDay ? latest.totalAsset - previousDay.totalAsset : "";
  var dailyChangeRate = previousDay && previousDay.totalAsset ? dailyChange / previousDay.totalAsset : "";
  var weeklyChange = previousWeek ? latest.totalAsset - previousWeek.totalAsset : "";
  var weeklyChangeRate = previousWeek && previousWeek.totalAsset ? weeklyChange / previousWeek.totalAsset : "";

  if (isNumber_(dailyChangeRate) && Math.abs(dailyChangeRate) >= 0.03) {
    alerts.push({
      level: Math.abs(dailyChangeRate) >= 0.05 ? "critical" : "warn",
      title: "Daily change alert",
      body: "Total asset moved by " + formatSignedPercent_(dailyChangeRate) + " since yesterday."
    });
  }

  if (isNumber_(weeklyChangeRate) && Math.abs(weeklyChangeRate) >= 0.05) {
    alerts.push({
      level: Math.abs(weeklyChangeRate) >= 0.10 ? "critical" : "warn",
      title: "Weekly change alert",
      body: "Total asset moved by " + formatSignedPercent_(weeklyChangeRate) + " over the last 7 days."
    });
  }

  if (isNumber_(latest.gainRate) && latest.gainRate <= -0.05) {
    alerts.push({
      level: "warn",
      title: "Loss alert",
      body: "Current gain rate is " + formatSignedPercent_(latest.gainRate) + "."
    });
  }

  if (isNumber_(latest.watchCount) && latest.watchCount > 0) {
    alerts.push({
      level: "info",
      title: "Watching " + latest.watchCount + " names",
      body: "Use the watchlist for timing and budget checks."
    });
  }

  return {
    latest: latest,
    previousDay: previousDay,
    previousWeek: previousWeek,
    dailyChange: dailyChange,
    dailyChangeRate: dailyChangeRate,
    weeklyChange: weeklyChange,
    weeklyChangeRate: weeklyChangeRate,
    alerts: alerts
  };
}

function toNumber_(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && isFinite(value)) return value;

  var n = Number(String(value).replace(/,/g, ""));
  return isFinite(n) ? n : "";
}

function isNumber_(value) {
  return typeof value === "number" && isFinite(value);
}

function formatSignedPercent_(value) {
  var sign = value >= 0 ? "+" : "";
  return sign + (value * 100).toFixed(1) + "%";
}

function findSnapshotBeforeDays_(snapshots, latestDateKey, days) {
  var latestDate = parseDateKey_(latestDateKey);
  if (!latestDate) return null;

  var target = new Date(latestDate);
  target.setDate(target.getDate() - days);

  for (var i = snapshots.length - 1; i >= 0; i--) {
    var snapshotDate = parseDateKey_(snapshots[i].dateKey);
    if (snapshotDate && snapshotDate <= target) {
      return snapshots[i];
    }
  }

  return null;
}

function parseDateKey_(value) {
  if (!value) return null;

  var text = String(value);
  var parts = text.split("/");
  if (parts.length !== 3) return null;

  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
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
