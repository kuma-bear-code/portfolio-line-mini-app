function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ポートフォリオ更新")
    .addItem("API日次スナップショット更新", "runApiDailySnapshot")
    .addItem("履歴重複を整理", "cleanupApiDailyHistoryDuplicates")
    .addItem("毎日18時の自動更新を作成", "createApiDailyTrigger")
    .addToUi();
}

function runApiDailySnapshot() {
  clearApiLog_();

  var result = updateApiPortfolioValuesFromWatch_();

  appendApiDailyPriceHistory_();
  appendApiDailySnapshot_(result);
}

function updateApiPortfolioValuesFromWatch_() {
  var ss = getPortfolioSpreadsheet_();
  var watchSheet = ss.getSheetByName(CONFIG.SHEET_WATCH);

  if (!watchSheet) {
    throw new Error("ウォッチ銘柄マスター シートが見つかりません。");
  }

  var apiSheet = getOrCreateSheet_(CONFIG.SHEET_API_PRICE);
  var watchRows = getTableValues_(watchSheet, 2, 1, 13);
  var now = new Date();

  var usdJpy = "";
  try {
    usdJpy = fetchYahooRegularMarketPrice_("JPY=X");
  } catch (e) {
    writeApiLog_("JPY=X", "", "", "", "NG", "USDJPY取得失敗: " + e.message);
  }

  var rows = [];
  var totalValue = 0;
  var jpValue = 0;
  var usValue = 0;
  var stockCount = 0;
  var watchCount = 0;
  var simTotalValue = 0;
  var simTotalGain = 0;

  for (var i = 0; i < watchRows.length; i++) {
    var r = watchRows[i];

    var code = String(r[0] || "").trim();
    var name = String(r[1] || "").trim();
    var type = String(r[2] || "").trim();
    var yahooSymbol = String(r[3] || "").trim();
    var currency = String(r[4] || "JPY").trim();
    var broker = String(r[5] || "").trim();
    var currentQty = Number(r[6] || 0);
    var compareQty = Number(r[7] || 0);
    var trackSold = toBoolean_(r[8]);
    var watchMemo = String(r[9] || "").trim();
    var watchEnabled = toBoolean_(r[10]);
    var simQty = Number(r[11] || 0);
    var simCost = Number(r[12] || 0);

    if (!name || !yahooSymbol) continue;
    if (currentQty <= 0 && compareQty <= 0 && !trackSold && !watchEnabled && simQty <= 0) continue;

    var trackingType = "";
    if (currentQty > 0) {
      trackingType = "現在保有";
    } else if (trackSold) {
      trackingType = "売却済みウォッチ";
    } else {
      trackingType = "監視銘柄";
      watchCount++;
    }

    if (/投信/.test(type) || /野村インド|世界半導体|eMAXIS|S&P500|Ｓ＆Ｐ５００/i.test(name)) {
      rows.push([
        broker,
        code,
        name,
        currentQty,
        "投信_除外",
        yahooSymbol,
        "",
        currency,
        "",
        "",
        "",
        now,
        "SKIP",
        "投信はAPI日次では除外。月末に別管理。",
        trackingType,
        compareQty,
        "",
        simQty,
        simCost,
        "",
        "",
        ""
      ]);
      continue;
    }

    var price = "";
    var fx = currency === "USD" ? usdJpy : 1;
    var priceJpy = "";
    var currentValueJpy = "";
    var compareValueJpy = "";
    var simValueJpy = "";
    var simGainJpy = "";
    var simGainRate = "";
    var status = "NG";
    var memo = "";

    try {
      price = fetchYahooRegularMarketPrice_(yahooSymbol);

      if (currency === "USD" && !fx) {
        memo = "USDJPY未取得のため円換算不可";
      } else {
        priceJpy = currency === "USD" ? price * fx : price;
        currentValueJpy = currentQty > 0 ? currentQty * priceJpy : 0;
        compareValueJpy = compareQty > 0 ? compareQty * priceJpy : 0;

        if (simQty > 0) {
          simValueJpy = simQty * priceJpy;
          simGainJpy = simCost > 0 ? simValueJpy - simCost : "";
          simGainRate = simCost > 0 ? simGainJpy / simCost : "";
          simTotalValue += Number(simValueJpy || 0);
          simTotalGain += Number(simGainJpy || 0);
        }

        if (currentQty > 0) {
          totalValue += currentValueJpy;
          stockCount++;

          if (currency === "USD") {
            usValue += currentValueJpy;
          } else {
            jpValue += currentValueJpy;
          }
        }

        status = "OK";
        memo = watchMemo || "Yahoo Finance chart APIから取得";
      }
    } catch (e) {
      memo = "価格取得失敗: " + e.message;
    }

    rows.push([
      broker,
      code,
      name,
      currentQty,
      type,
      yahooSymbol,
      price,
      currency,
      fx,
      priceJpy,
      currentValueJpy,
      now,
      status,
      memo,
      trackingType,
      compareQty,
      compareValueJpy,
      simQty,
      simCost,
      simValueJpy,
      simGainJpy,
      simGainRate
    ]);
  }

  apiSheet.clearContents();

  apiSheet.getRange(1, 1, 1, 22).setValues([[
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
    "追跡区分",
    "比較数量",
    "比較評価額_円",
    "仮想購入数量",
    "仮想取得原価_円",
    "仮想評価額_円",
    "仮想損益_円",
    "仮想損益率"
  ]]);

  if (rows.length > 0) {
    apiSheet.getRange(2, 1, rows.length, 22).setValues(rows);
  }

  apiSheet.getRange("A1:V1").setFontWeight("bold");
  apiSheet.getRange("G2:K").setNumberFormat("#,##0.00");
  apiSheet.getRange("Q2:U").setNumberFormat("#,##0.00");
  apiSheet.getRange("V2:V").setNumberFormat("0.00%");
  apiSheet.getRange("L2:L").setNumberFormat("yyyy/mm/dd hh:mm");
  apiSheet.autoResizeColumns(1, 22);

  return {
    totalValue: totalValue,
    jpValue: jpValue,
    usValue: usValue,
    fundValue: 0,
    cash: CONFIG.CASH_JPY,
    stockCount: stockCount,
    watchCount: watchCount,
    simTotalValue: simTotalValue,
    simTotalGain: simTotalGain,
    usdJpy: usdJpy
  };
}

function appendApiDailyPriceHistory_() {
  var ss = getPortfolioSpreadsheet_();
  var apiSheet = ss.getSheetByName(CONFIG.SHEET_API_PRICE);
  var historySheet = getOrCreateSheet_(CONFIG.SHEET_API_HISTORY);

  if (!apiSheet) {
    throw new Error("API価格取得・評価額 シートが見つかりません。");
  }

  ensureApiHistoryHeader_(historySheet);

  var rows = getTableValues_(apiSheet, 2, 1, 22);
  if (rows.length === 0) return;

  var today = new Date();
  var todayText = Utilities.formatDate(today, CONFIG.TIME_ZONE, "yyyy/MM/dd");
  var historyDate = makeDateOnly_(today, CONFIG.TIME_ZONE);

  var existingMap = buildHistoryKeyMap_(historySheet);

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var broker = r[0];
    var code = r[1];
    var name = r[2];
    var status = r[12];

    if (status !== "OK") continue;

    var key = makeHistoryKey_(todayText, broker, code, name);

    var line = [
      historyDate,
      broker,
      code,
      name,
      r[3],
      r[4],
      r[5],
      r[6],
      r[7],
      r[8],
      r[9],
      r[10],
      r[11],
      r[12],
      r[13],
      key,
      r[14],
      r[15],
      r[16],
      r[17],
      r[18],
      r[19],
      r[20],
      r[21]
    ];

    if (existingMap[key]) {
      historySheet.getRange(existingMap[key], 1, 1, 24).setValues([line]);
    } else {
      historySheet.appendRow(line);
    }
  }

  formatApiHistorySheet_(historySheet);
}

function cleanupApiDailyHistoryDuplicates() {
  var ss = getPortfolioSpreadsheet_();
  var sheet = ss.getSheetByName(CONFIG.SHEET_API_HISTORY);

  if (!sheet) {
    throw new Error("API日次履歴CSV シートが見つかりません。");
  }

  ensureApiHistoryHeader_(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, 24).getValues();
  var map = {};

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var dateText = normalizeDateText_(row[0]);
    var key = makeHistoryKey_(dateText, row[1], row[2], row[3]);

    row[0] = makeDateFromText_(dateText);
    row[15] = key;

    map[key] = row;
  }

  var cleaned = Object.keys(map)
    .sort()
    .map(function (key) {
      return map[key];
    });

  sheet.getRange(2, 1, lastRow - 1, 24).clearContent();

  if (cleaned.length > 0) {
    sheet.getRange(2, 1, cleaned.length, 24).setValues(cleaned);
  }

  formatApiHistorySheet_(sheet);
}

function appendApiDailySnapshot_(result) {
  var ss = getPortfolioSpreadsheet_();
  var snapSheet = getOrCreateSheet_(CONFIG.SHEET_DAILY_SNAPSHOT);
  var trueCapitalSheet = ss.getSheetByName(CONFIG.SHEET_TRUE_CAPITAL);

  ensureSnapshotHeader_(snapSheet);

  var trueCapital = "";
  if (trueCapitalSheet) {
    trueCapital = Number(trueCapitalSheet.getRange("B16").getValue() || 0);
  }

  var today = new Date();
  var todayText = Utilities.formatDate(today, CONFIG.TIME_ZONE, "yyyy/MM/dd");
  var todayDate = makeDateOnly_(today, CONFIG.TIME_ZONE);

  var totalAsset = result.totalValue + result.cash;
  var gain = trueCapital ? totalAsset - trueCapital : "";
  var gainRate = trueCapital ? gain / trueCapital : "";

  var rowData = [[
    todayDate,
    result.totalValue,
    result.cash,
    totalAsset,
    trueCapital,
    gain,
    gainRate,
    result.jpValue,
    result.usValue,
    result.fundValue,
    result.stockCount,
    result.watchCount,
    result.simTotalValue,
    result.simTotalGain,
    "API日次。監視銘柄含む価格記録。売却済み銘柄は比較保持。USDJPY=" + result.usdJpy
  ]];

  var lastRow = snapSheet.getLastRow();

  if (lastRow >= 2) {
    var dates = snapSheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (var i = 0; i < dates.length; i++) {
      var key = normalizeDateText_(dates[i][0]);

      if (key === todayText) {
        snapSheet.getRange(i + 2, 1, 1, 15).setValues(rowData);
        formatSnapshotSheet_(snapSheet);
        return;
      }
    }
  }

  snapSheet.appendRow(rowData[0]);
  formatSnapshotSheet_(snapSheet);
}

function fetchYahooRegularMarketPrice_(symbol) {
  var url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?range=5d&interval=1d";

  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  var status = res.getResponseCode();
  var text = res.getContentText();

  if (status !== 200 || !text) {
    writeApiLog_(symbol, url, status, "", "NG", "HTTPエラー");
    throw new Error("HTTP " + status);
  }

  var json = JSON.parse(text);

  if (
    !json.chart ||
    !json.chart.result ||
    !json.chart.result[0] ||
    !json.chart.result[0].meta
  ) {
    writeApiLog_(symbol, url, status, "", "NG", "JSON構造不正");
    throw new Error("JSON構造不正");
  }

  var meta = json.chart.result[0].meta;
  var price = meta.regularMarketPrice;

  if (!price || !isFinite(Number(price))) {
    var quote =
      json.chart.result[0].indicators &&
      json.chart.result[0].indicators.quote &&
      json.chart.result[0].indicators.quote[0];

    if (quote && quote.close && quote.close.length > 0) {
      for (var i = quote.close.length - 1; i >= 0; i--) {
        if (quote.close[i] && isFinite(Number(quote.close[i]))) {
          price = quote.close[i];
          break;
        }
      }
    }
  }

  price = Number(price);

  if (!isFinite(price)) {
    writeApiLog_(symbol, url, status, "", "NG", "価格なし");
    throw new Error("価格なし");
  }

  writeApiLog_(symbol, url, status, price, "OK", "");
  return price;
}

function createApiDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runApiDailySnapshot") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("runApiDailySnapshot")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();
}
