(function () {
  var state = {
    data: null,
    range: "30",
    metric: "asset"
  };

  var moneyFmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
  var pctFmt = new Intl.NumberFormat("ja-JP", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindTabs();
    bindMetrics();
    bindRanges();
    syncControls();

    var refreshButton = document.getElementById("refreshButton");
    if (refreshButton) {
      refreshButton.addEventListener("click", loadApp);
    }

    loadApp();
  });

  function bindTabs() {
    document.querySelectorAll(".tab").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (tab) {
          tab.classList.remove("is-active");
        });
        document.querySelectorAll(".panel").forEach(function (panel) {
          panel.classList.remove("is-active");
        });
        button.classList.add("is-active");
        var panel = document.querySelector('[data-panel="' + button.dataset.tab + '"]');
        if (panel) panel.classList.add("is-active");
      });
    });
  }

  function bindMetrics() {
    document.querySelectorAll(".metric-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        state.metric = button.dataset.metric || "asset";
        localStorage.setItem("portfolio.metric", state.metric);
        document.querySelectorAll(".metric-btn").forEach(function (btn) {
          btn.classList.remove("is-active");
        });
        button.classList.add("is-active");
        renderChart();
      });
    });
  }

  function bindRanges() {
    document.querySelectorAll(".range-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        state.range = button.dataset.range || "30";
        localStorage.setItem("portfolio.range", state.range);
        document.querySelectorAll(".range-btn").forEach(function (btn) {
          btn.classList.remove("is-active");
        });
        button.classList.add("is-active");
        renderChart();
      });
    });
  }

  function syncControls() {
    var savedRange = localStorage.getItem("portfolio.range");
    var savedMetric = localStorage.getItem("portfolio.metric");
    if (savedRange) state.range = savedRange;
    if (savedMetric) state.metric = savedMetric;

    document.querySelectorAll(".range-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.range === state.range);
    });
    document.querySelectorAll(".metric-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.metric === state.metric);
    });
  }

  function loadApp() {
    setLoadingState(true);
    fetchPortfolioData()
      .then(function (data) {
        state.data = data;
        return initLiffIfNeeded((window.PORTFOLIO_APP_CONFIG || {}).liffId);
      })
      .then(function () {
        renderApp(state.data || {});
      })
      .catch(function (error) {
        renderError(error);
      })
      .finally(function () {
        setLoadingState(false);
      });
  }

  function fetchPortfolioData() {
    var baseUrl = (window.PORTFOLIO_APP_CONFIG || {}).apiBaseUrl;
    if (!baseUrl || baseUrl.indexOf("REPLACE_WITH") >= 0) {
      return Promise.reject(new Error("Apps Script の Web App URL が未設定です。"));
    }

    var url = baseUrl + (baseUrl.indexOf("?") >= 0 ? "&" : "?") + "api=portfolio";
    return jsonp(url);
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = "__portfolioCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      var script = document.createElement("script");
      var timeoutId = null;

      function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        if (script.parentNode) script.parentNode.removeChild(script);
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
      }

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("ポートフォリオデータの読み込みに失敗しました。"));
      };

      timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("ポートフォリオデータの読み込みがタイムアウトしました。"));
      }, 15000);

      script.src = url + "&callback=" + callbackName;
      document.body.appendChild(script);
    });
  }

  function initLiffIfNeeded(liffId) {
    if (!window.liff || !liffId || liffId.indexOf("REPLACE_WITH") >= 0) {
      return Promise.resolve();
    }
    return window.liff.init({ liffId: liffId });
  }

  function renderApp(data) {
    renderHero(data.home || {});
    renderHome(data.home || {});
    renderHoldings(data.holdings || []);
    renderWatchlist(data.watchlist || []);
    renderWeekly(data.weekly || {});
    renderAlerts(data.insights || {});
    renderChart();
  }

  function renderHero(home) {
    var metrics = [
      ["総資産", home.totalAsset],
      ["損益", home.gainAmount],
      ["損益率", home.gainRate],
      ["保有銘柄数", home.holdingCount]
    ];

    var target = document.getElementById("heroMetrics");
    if (!target) return;

    target.innerHTML = metrics.map(function (pair) {
      return '<div class="metric-card"><div class="metric-label">' +
        escapeHtml(pair[0]) + '</div><div class="metric-value">' +
        escapeHtml(displayValue(pair[1])) + "</div></div>";
    }).join("");
  }

  function renderHome(home) {
    renderSummaryList("homeSummary", [
      ["最終更新", home.updatedAt],
      ["総資産", home.totalAsset],
      ["真の原資", home.trueCapital],
      ["損益", home.gainAmount],
      ["損益率", home.gainRate],
      ["現金", home.cash],
      ["保有銘柄数", home.holdingCount],
      ["最大構成", home.maxWeight],
      ["最大構成比", home.maxWeightRate],
      ["価格API", home.apiStatus],
      ["監視API", home.watchApiStatus]
    ]);
  }

  function renderHoldings(items) {
    renderCardList("holdingsList", items, function (item) {
      return ""
        + '<div class="list-item-title"><div><div class="list-item-name">' + escapeHtml(item.name || "") + "</div>"
        + '<div class="list-item-code">' + escapeHtml(item.code || "") + "</div></div>"
        + '<span class="pill">' + escapeHtml(item.type || "保有") + "</span></div>"
        + '<div class="list-grid">'
        + kv("数量", item.qty)
        + kv("評価額", item.valueJpy)
        + kv("単価", item.priceJpy)
        + kv("証券会社", item.broker)
        + "</div>"
        + (item.memo ? '<div class="item-memo">' + escapeHtml(item.memo) + "</div>" : "");
    });
  }

  function renderWatchlist(items) {
    renderCardList("watchlistList", items, function (item) {
      return ""
        + '<div class="list-item-title"><div><div class="list-item-name">' + escapeHtml(item.name || "") + "</div>"
        + '<div class="list-item-code">' + escapeHtml(item.code || "") + "</div></div>"
        + '<span class="pill ' + judgeClass(item.autoJudge) + '">' +
        escapeHtml(item.autoJudge || item.manualHint || "監視中") + "</span></div>"
        + '<div class="list-grid">'
        + kv("テーマ", item.theme)
        + kv("現在価格", item.currentPrice)
        + kv("騰落率", item.changeRate)
        + kv("目標買付額", item.targetBudget)
        + kv("差額", item.diff)
        + kv("レビュー", item.reviewPoint || item.manualHint)
        + "</div>";
    });
  }

  function renderWeekly(weekly) {
    renderSummaryList("weeklySummary", [
      ["最終更新", weekly.updatedAt],
      ["監視銘柄数", weekly.watchCount],
      ["押し目候補数", weekly.dipCount],
      ["メモ", weekly.memo]
    ]);

    renderSimpleRows("themeList", weekly.themes || []);
    renderSimpleRows("candidateList", weekly.candidates || []);
    renderSimpleRows("budgetList", weekly.budgets || []);
  }

  function renderAlerts(insights) {
    var el = document.getElementById("alertList");
    if (!el) return;

    var rows = [];
    if (insights && (insights.dailyChangeRate !== "" || insights.weeklyChangeRate !== "")) {
      rows.push('<div class="summary-list compact">');
      if (insights.dailyChangeRate !== "") {
        rows.push(
          '<div class="summary-row"><div class="summary-key">前日比</div><div class="summary-value">' +
          escapeHtml(formatSignedMoney(insights.dailyChange)) + " / " +
          escapeHtml(formatPercent(insights.dailyChangeRate)) + "</div></div>"
        );
      }
      if (insights.weeklyChangeRate !== "") {
        rows.push(
          '<div class="summary-row"><div class="summary-key">週次比</div><div class="summary-value">' +
          escapeHtml(formatSignedMoney(insights.weeklyChange)) + " / " +
          escapeHtml(formatPercent(insights.weeklyChangeRate)) + "</div></div>"
        );
      }
      rows.push("</div>");
    }

    var alerts = (insights && insights.alerts) || [];
    if (!alerts.length) {
      el.innerHTML = rows.join("") + '<div class="empty">アラートはありません。</div>';
      return;
    }

    rows.push('<div class="stack-list">');
    rows.push(alerts.map(function (alert) {
      return '<div class="alert-row ' + (alert.level || "info") + '">' +
        '<div class="alert-title">' + escapeHtml(alert.title || "") + "</div>" +
        '<div class="alert-body">' + escapeHtml(alert.body || "") + "</div>" +
        "</div>";
    }).join(""));
    rows.push("</div>");

    el.innerHTML = rows.join("");
  }

  function renderChart() {
    var container = document.getElementById("chartContainer");
    var meta = document.getElementById("chartMeta");
    var summary = document.getElementById("chartSummary");
    var legend = document.getElementById("chartLegend");
    if (!container || !meta || !summary) return;

    var metric = getChartMetricConfig(state.metric);
    var snapshots = (state.data && state.data.snapshots) || [];
    if (!snapshots.length) {
      container.innerHTML = '<div class="empty">まだ資産推移データがありません。</div>';
      meta.textContent = "スナップショット待ち";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    var filtered = filterSnapshots(snapshots, state.range);
    if (!filtered.length) {
      container.innerHTML = '<div class="empty">この期間のデータがありません。</div>';
      meta.textContent = "期間内データなし";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    var points = filtered.map(function (row) {
      return {
        date: row.date,
        value: metric.value(row),
        capital: toNumber(row.trueCapital),
        asset: toNumber(row.totalAsset),
        cash: toNumber(row.cash),
        gainRate: toPercent(row.gainRate)
      };
    }).filter(function (row) {
      return row.date && isFiniteNumber(row.value);
    });

    if (!points.length) {
      container.innerHTML = '<div class="empty">グラフを描画できませんでした。</div>';
      meta.textContent = "描画失敗";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    var values = points.map(function (p) { return p.value; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);

    if (metric.overlay === "trueCapital") {
      var caps = points.map(function (p) { return p.capital; }).filter(isFiniteNumber);
      if (caps.length) {
        min = Math.min.apply(null, values.concat(caps));
        max = Math.max.apply(null, values.concat(caps));
      }
    } else if (metric.overlay === "zero") {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }

    if (!isFinite(min) || !isFinite(max)) {
      container.innerHTML = '<div class="empty">グラフ範囲を計算できませんでした。</div>';
      meta.textContent = "描画失敗";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    if (min === max) {
      var padValue = Math.max(Math.abs(min) * 0.05, metric.unit === "percent" ? 0.01 : 1);
      min -= padValue;
      max += padValue;
    } else {
      var padValue2 = (max - min) * 0.08;
      min -= padValue2;
      max += padValue2;
    }

    var range = Math.max(max - min, metric.unit === "percent" ? 0.01 : 1);
    var width = 1000;
    var height = 320;
    var pad = { top: 24, right: 24, bottom: 38, left: 80 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="資産推移グラフ">');
    svg.push('<defs><linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0f5f74" stop-opacity="0.22"></stop><stop offset="100%" stop-color="#0f5f74" stop-opacity="0.02"></stop></linearGradient></defs>');

    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (plotH / 4) * i;
      var value = max - (range / 4) * i;
      svg.push('<line x1="' + pad.left + '" y1="' + y + '" x2="' + (width - pad.right) + '" y2="' + y + '" class="chart-grid"></line>');
      svg.push('<text x="' + (pad.left - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="chart-label">' + escapeHtml(metric.axis(value)) + "</text>");
    }

    var areaPath = buildPath(points, pad, plotW, plotH, min, range, true);
    var linePath = buildPath(points, pad, plotW, plotH, min, range, false);
    svg.push('<path d="' + areaPath + '" fill="url(#assetFill)"></path>');
    svg.push('<path d="' + linePath + '" class="chart-line"></path>');

    if (metric.overlay === "trueCapital") {
      var capitalLine = buildHorizontalLine(points, pad, plotW, plotH, min, range, function (point) {
        return point.capital;
      });
      if (capitalLine) svg.push('<path d="' + capitalLine + '" class="chart-capital"></path>');
    } else if (metric.overlay === "zero" && min <= 0 && max >= 0) {
      var zeroLine = buildHorizontalLine(points, pad, plotW, plotH, min, range, function () {
        return 0;
      });
      if (zeroLine) svg.push('<path d="' + zeroLine + '" class="chart-capital"></path>');
    }

    buildMarkers(points, pad, plotW, plotH, min, range).forEach(function (marker) {
      svg.push(marker);
    });

    getXAxisLabels(points).forEach(function (label) {
      var x = pad.left + (plotW * label.idx / Math.max(points.length - 1, 1));
      svg.push('<text x="' + x + '" y="' + (height - 12) + '" text-anchor="middle" class="chart-label">' + escapeHtml(label.text) + "</text>");
    });

    svg.push("</svg>");
    container.innerHTML = svg.join("");

    var first = points[0];
    var last = points[points.length - 1];
    var delta = last.value - first.value;
    var deltaRate = first.value ? delta / Math.abs(first.value) : 0;
    meta.textContent = metric.label + " / " + filtered[0].date + " から " + filtered[filtered.length - 1].date;
    summary.innerHTML = [
      pill("開始", metric.format(first.value)),
      pill("現在", metric.format(last.value)),
      pill(delta >= 0 ? "差分 +" + metric.format(delta) : "差分 " + metric.format(delta), null, delta >= 0 ? "good" : "warn"),
      pill(formatPercent(deltaRate), null, delta >= 0 ? "good" : "warn")
    ].join("");

    if (legend) {
      legend.innerHTML = [
        '<span class="legend-item"><span class="legend-swatch asset"></span>' + escapeHtml(metric.label) + "</span>",
        metric.overlay === "trueCapital"
          ? '<span class="legend-item"><span class="legend-swatch capital"></span>真の原資</span>'
          : '<span class="legend-item"><span class="legend-swatch zero"></span>基準線</span>'
      ].join("");
    }
  }

  function filterSnapshots(snapshots, range) {
    var sorted = snapshots
      .map(function (row) {
        return {
          date: row.date,
          totalAsset: row.totalAsset,
          trueCapital: row.trueCapital
        };
      })
      .filter(function (row) {
        return row.date;
      })
      .sort(function (a, b) {
        var da = parseDate(a.date);
        var db = parseDate(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });

    if (range === "all") return sorted;

    var days = Number(range) || 30;
    var cutoff = startOfDay(new Date());
    cutoff.setDate(cutoff.getDate() - (days - 1));

    return sorted.filter(function (row) {
      var d = parseDate(row.date);
      return d && d >= cutoff;
    });
  }

  function buildPath(points, pad, plotW, plotH, min, range, area) {
    if (!points.length) return "";

    var coords = points.map(function (p, idx) {
      var x = pad.left + (plotW * idx / Math.max(points.length - 1, 1));
      var y = pad.top + plotH - ((p.value - min) / range) * plotH;
      return [x, y];
    });

    var d = "M " + coords[0][0] + " " + coords[0][1];
    for (var i = 1; i < coords.length; i++) {
      d += " L " + coords[i][0] + " " + coords[i][1];
    }

    if (area) {
      d += " L " + coords[coords.length - 1][0] + " " + (pad.top + plotH);
      d += " L " + coords[0][0] + " " + (pad.top + plotH) + " Z";
    }

    return d;
  }

  function buildHorizontalLine(points, pad, plotW, plotH, min, range, valueGetter) {
    var sample = points[0];
    var value = toNumber(valueGetter ? valueGetter(sample) : sample && sample.capital);
    if (!isFiniteNumber(value)) return "";
    var y = pad.top + plotH - ((value - min) / range) * plotH;
    return "M " + pad.left + " " + y + " L " + (pad.left + plotW) + " " + y;
  }

  function buildMarkers(points, pad, plotW, plotH, min, range) {
    var out = [];
    var step = Math.max(Math.floor(points.length / 6), 1);

    for (var i = 0; i < points.length; i += step) {
      var p = points[i];
      var x = pad.left + (plotW * i / Math.max(points.length - 1, 1));
      var y = pad.top + plotH - ((p.value - min) / range) * plotH;
      out.push('<circle cx="' + x + '" cy="' + y + '" r="3.5" class="chart-dot"></circle>');
    }

    if (points.length > 1 && (points.length - 1) % step !== 0) {
      var last = points[points.length - 1];
      var x2 = pad.left + plotW;
      var y2 = pad.top + plotH - ((last.value - min) / range) * plotH;
      out.push('<circle cx="' + x2 + '" cy="' + y2 + '" r="3.5" class="chart-dot"></circle>');
    }

    return out;
  }

  function getXAxisLabels(points) {
    if (points.length <= 2) {
      return points.map(function (p, idx) {
        return { idx: idx, text: p.date };
      });
    }

    var picks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    var seen = {};
    return picks.map(function (idx) {
      if (seen[idx]) return null;
      seen[idx] = true;
      return { idx: idx, text: points[idx].date };
    }).filter(Boolean);
  }

  function getChartMetricConfig(metric) {
    switch (metric) {
      case "gain":
        return {
          label: "損益",
          unit: "money",
          value: function (row) { return toNumber(row.gainAmount); },
          axis: formatCompact,
          format: formatNumber,
          overlay: "zero"
        };
      case "cash":
        return {
          label: "現金",
          unit: "money",
          value: function (row) { return toNumber(row.cash); },
          axis: formatCompact,
          format: formatNumber,
          overlay: "zero"
        };
      case "holdings":
        return {
          label: "保有評価",
          unit: "money",
          value: function (row) { return toNumber(row.totalAsset) - toNumber(row.cash); },
          axis: formatCompact,
          format: formatNumber,
          overlay: "zero"
        };
      case "gainRate":
        return {
          label: "損益率",
          unit: "percent",
          value: function (row) { return toPercent(row.gainRate); },
          axis: formatPercent,
          format: formatPercent,
          overlay: "zero"
        };
      case "trueCapital":
        return {
          label: "真の原資",
          unit: "money",
          value: function (row) { return toNumber(row.trueCapital); },
          axis: formatCompact,
          format: formatNumber,
          overlay: null
        };
      case "asset":
      default:
        return {
          label: "総資産",
          unit: "money",
          value: function (row) { return toNumber(row.totalAsset); },
          axis: formatCompact,
          format: formatNumber,
          overlay: "trueCapital"
        };
    }
  }

  function toPercent(value) {
    if (typeof value === "number" && isFinite(value)) return value;
    var text = String(value == null ? "" : value).trim();
    if (!text) return NaN;
    var parsed = Number(text.replace(/%/g, "").replace(/,/g, ""));
    if (!isFinite(parsed)) return NaN;
    return parsed / 100;
  }

  function pill(text, value, tone) {
    var cls = tone ? "summary-pill " + tone : "summary-pill";
    return '<span class="' + cls + '">' + escapeHtml(text) + (value ? " " + escapeHtml(value) : "") + "</span>";
  }

  function renderSummaryList(id, rows) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = rows.map(function (pair) {
      return '<div class="summary-row"><div class="summary-key">' + escapeHtml(pair[0]) +
        '</div><div class="summary-value">' + escapeHtml(displayValue(pair[1]) || "-") + "</div></div>";
    }).join("");
  }

  function renderCardList(id, items, renderer) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="empty">まだデータがありません。</div>';
      return;
    }
    el.innerHTML = items.map(function (item) {
      return '<div class="list-item">' + renderer(item) + "</div>";
    }).join("");
  }

  function renderSimpleRows(id, rows) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div class="empty">まだデータがありません。</div>';
      return;
    }
    el.innerHTML = rows.map(function (row) {
      return '<div class="list-item"><div class="list-grid">' + row.map(function (cell, idx) {
        return '<div><div class="list-k">項目 ' + (idx + 1) + '</div><div class="list-v">' + escapeHtml(cell) + "</div></div>";
      }).join("") + "</div></div>";
    }).join("");
  }

  function kv(key, value) {
    return '<div><div class="list-k">' + escapeHtml(key) + '</div><div class="list-v">' + escapeHtml(displayValue(value) || "-") + "</div></div>";
  }

  function judgeClass(value) {
    var text = String(value || "");
    if (!text) return "";
    if (/買|好|上昇/.test(text)) return "good";
    if (/注意|警戒|下落|売/.test(text)) return "warn";
    return "";
  }

  function setLoadingState(isLoading) {
    var button = document.getElementById("refreshButton");
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? "…" : "↻";
  }

  function renderError(error) {
    var message = error && error.message ? error.message : String(error || "読み込みに失敗しました");
    var hero = document.getElementById("heroMetrics");
    if (hero) {
      hero.innerHTML =
        '<div class="metric-card"><div class="metric-label">エラー</div><div class="metric-value">' +
        escapeHtml(message) + "</div></div>";
    }
    var chart = document.getElementById("chartContainer");
    if (chart) {
      chart.innerHTML = '<div class="empty">' + escapeHtml(message) + "</div>";
    }
  }

  function formatSignedMoney(value) {
    var n = toNumber(value);
    if (!isFiniteNumber(n)) return "-";
    return (n >= 0 ? "+" : "") + formatNumber(Math.abs(n));
  }

  function displayValue(value) {
    if (value == null || value === "") return "";
    return String(value);
  }

  function formatNumber(value) {
    if (!isFiniteNumber(value)) return "-";
    return moneyFmt.format(Math.round(value));
  }

  function formatCompact(value) {
    if (!isFiniteNumber(value)) return "-";
    var abs = Math.abs(value);
    if (abs >= 100000000) return (value / 100000000).toFixed(1) + "億";
    if (abs >= 10000) return (value / 10000).toFixed(1) + "万";
    if (abs >= 1000) return (value / 1000).toFixed(1) + "千";
    return moneyFmt.format(Math.round(value));
  }

  function formatPercent(value) {
    if (!isFiniteNumber(value)) return "-";
    return pctFmt.format(value);
  }

  function toNumber(value) {
    var n = Number(String(value || "").replace(/,/g, ""));
    return isFinite(n) ? n : NaN;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function parseDate(text) {
    if (!text) return null;
    var s = String(text).trim().replace(/-/g, "/");
    var parts = s.split("/");
    if (parts.length < 3) return null;
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var d = Number(parts[2]);
    var date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : startOfDay(date);
  }

  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
