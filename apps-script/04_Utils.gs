function ensureApiHistoryHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 24).setValues([[
      "日付",
      "証券会社",
      "銘柄コード",
      "銘柄名",
      "現在保有数量",
      "区分",
      "Yahooシンボル",
      "取得価格",
      "通貨",
      "為替",
      "円換算単価",
      "現在評価額_円",
      "取得日時",
      "判定",
      "メモ",
      "履歴キー",
      "追跡区分",
      "比較数量",
      "比較評価額_円",
      "仮想購入数量",
      "仮想取得原価_円",
      "仮想評価額_円",
      "仮想損益_円",
      "仮想損益率"
    ]]);
  }
}

function ensureSnapshotHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 15).setValues([[
      "日付",
      "総評価額",
      "現金残高",
      "総資産",
      "真の原資",
      "増減額",
      "増減率",
      "日本株評価額",
      "米国株評価額",
      "投信評価額",
      "保有銘柄数",
      "監視銘柄数",
      "仮想評価額合計",
      "仮想損益合計",
      "メモ"
    ]]);
  }
}

function buildHistoryKeyMap_(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) return map;

  var values = sheet.getRange(2, 1, lastRow - 1, 24).getValues();

  for (var i = 0; i < values.length; i++) {
    var key = values[i][15];
    if (key) {
      map[String(key)] = i + 2;
    }
  }

  return map;
}

function makeHistoryKey_(dateText, broker, code, name) {
  return [
    dateText,
    String(broker || "").trim(),
    String(code || "").trim(),
    String(name || "").trim()
  ].join("|");
}

function makeDateOnly_(date, timeZone) {
  var text = Utilities.formatDate(date, timeZone, "yyyy/MM/dd");
  return makeDateFromText_(text);
}

function makeDateFromText_(text) {
  var parts = String(text).split("/");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function normalizeDateText_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, CONFIG.TIME_ZONE, "yyyy/MM/dd");
  }

  var s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    s = s.substring(0, 10).replace(/-/g, "/");
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    var p = s.split("/");
    return [
      p[0],
      ("0" + p[1]).slice(-2),
      ("0" + p[2]).slice(-2)
    ].join("/");
  }

  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, CONFIG.TIME_ZONE, "yyyy/MM/dd");
  }

  return s;
}

function toBoolean_(value) {
  if (value === true) return true;

  var s = String(value || "").trim().toUpperCase();
  return s === "TRUE" || s === "1" || s === "YES" || s === "Y";
}

function getTableValues_(sheet, startRow, startCol, numCols) {
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) return [];

  var values = sheet
    .getRange(startRow, startCol, lastRow - startRow + 1, numCols)
    .getValues();

  var out = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var hasValue = false;

    for (var j = 0; j < row.length; j++) {
      if (row[j] !== "") {
        hasValue = true;
        break;
      }
    }

    if (hasValue) out.push(row);
  }

  return out;
}

function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  return sheet;
}

function clearApiLog_() {
  var sheet = getOrCreateSheet_(CONFIG.SHEET_API_LOG);
  sheet.clearContents();

  sheet.getRange(1, 1, 1, 7).setValues([[
    "日時",
    "Yahooシンボル",
    "URL",
    "HTTPステータス",
    "価格",
    "判定",
    "メモ"
  ]]);

  sheet.getRange("A1:G1").setFontWeight("bold");
}

function writeApiLog_(symbol, url, status, price, result, memo) {
  var sheet = getOrCreateSheet_(CONFIG.SHEET_API_LOG);

  if (sheet.getLastRow() === 0) {
    clearApiLog_();
  }

  sheet.appendRow([
    new Date(),
    symbol,
    url,
    status,
    price,
    result,
    memo
  ]);
}

function formatApiHistorySheet_(sheet) {
  sheet.getRange("A1:X1").setFontWeight("bold");
  sheet.getRange("A:A").setNumberFormat("yyyy/mm/dd");
  sheet.getRange("H:L").setNumberFormat("#,##0.00");
  sheet.getRange("M:M").setNumberFormat("yyyy/mm/dd hh:mm");
  sheet.getRange("Q:W").setNumberFormat("#,##0.00");
  sheet.getRange("X:X").setNumberFormat("0.00%");
  sheet.autoResizeColumns(1, 24);
}

function formatSnapshotSheet_(sheet) {
  sheet.getRange("A1:O1").setFontWeight("bold");
  sheet.getRange("A:A").setNumberFormat("yyyy/mm/dd");
  sheet.getRange("B:F").setNumberFormat("#,##0");
  sheet.getRange("G:G").setNumberFormat("0.00%");
  sheet.getRange("H:N").setNumberFormat("#,##0");
  sheet.autoResizeColumns(1, 15);
}
