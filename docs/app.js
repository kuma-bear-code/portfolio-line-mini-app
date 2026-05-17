(function () {
  const state = {
    data: null,
    range: "30",
    metric: "asset"
  };

  const moneyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindTabs();
    bindMetrics();
    bindRanges();
    syncControls();

    const refreshButton = document.getElementById("refreshButton");
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
        const panel = document.querySelector('[data-panel="' + button.dataset.tab + '"]');
        if (panel) panel.classList.add("is-active");
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

  function syncControls() {
    const savedRange = localStorage.getItem("portfolio.range");
    const savedMetric = localStorage.getItem("portfolio.metric");
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
    const baseUrl = (window.PORTFOLIO_APP_CONFIG || {}).apiBaseUrl;
    if (!baseUrl || baseUrl.indexOf("REPLACE_WITH") >= 0) {
      return Promise.reject(new Error("Apps Script Web App URL is missing."));
    }

    const url = baseUrl + (baseUrl.indexOf("?") >= 0 ? "&" : "?") + "api=portfolio";
    return jsonp(url);
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      const callbackName = "__portfolioCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const script = document.createElement("script");
      let timeoutId = null;

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
        reject(new Error("Failed to load portfolio data."));
      };

      timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("Portfolio request timed out."));
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
    renderChart();
  }

  function renderHero(home) {
    const metrics = [
      ["Total Asset", home.totalAsset],
      ["Gain", home.gainAmount],
      ["Gain Rate", home.gainRate],
      ["Holdings", home.holdingCount]
    ];

    const target = document.getElementById("heroMetrics");
    if (!target) return;

    target.innerHTML = metrics.map(function (pair) {
      return '<div class="metric-card"><div class="metric-label">' +
        escapeHtml(pair[0]) + '</div><div class="metric-value">' +
        escapeHtml(displayValue(pair[1])) + "</div></div>";
    }).join("");
  }

  function renderHome(home) {
    renderSummaryList("homeSummary", [
      ["Updated", home.updatedAt],
      ["Total Asset", home.totalAsset],
      ["True Capital", home.trueCapital],
      ["Gain", home.gainAmount],
      ["Gain Rate", home.gainRate],
      ["Cash", home.cash],
      ["Holdings", home.holdingCount],
      ["Max Weight", home.maxWeight],
      ["Max Weight Rate", home.maxWeightRate],
      ["Price API", home.apiStatus],
      ["Watch API", home.watchApiStatus]
    ]);
  }

  function renderHoldings(items) {
    renderCardList("holdingsList", items, function (item) {
      return ""
        + '<div class="list-item-title"><div><div class="list-item-name">' + escapeHtml(item.name || "") + "</div>"
        + '<div class="list-item-code">' + escapeHtml(item.code || "") + "</div></div>"
        + '<span class="pill">' + escapeHtml(item.type || "Holding") + "</span></div>"
        + '<div class="list-grid">'
        + kv("Qty", item.qty)
        + kv("Value", item.valueJpy)
        + kv("Price", item.priceJpy)
        + kv("Broker", item.broker)
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
        escapeHtml(item.autoJudge || item.manualHint || "Watching") + "</span></div>"
        + '<div class="list-grid">'
        + kv("Theme", item.theme)
        + kv("Price", item.currentPrice)
        + kv("Change", item.changeRate)
        + kv("Budget", item.targetBudget)
        + kv("Diff", item.diff)
        + kv("Review", item.reviewPoint || item.manualHint)
        + "</div>";
    });
  }

  function renderWeekly(weekly) {
    renderSummaryList("weeklySummary", [
      ["Updated", weekly.updatedAt],
      ["Watch Count", weekly.watchCount],
      ["Dip Count", weekly.dipCount],
      ["Memo", weekly.memo]
    ]);

    renderSimpleRows("themeList", weekly.themes || []);
    renderSimpleRows("candidateList", weekly.candidates || []);
    renderSimpleRows("budgetList", weekly.budgets || []);
  }

  function renderChart() {
    const container = document.getElementById("chartContainer");
    const meta = document.getElementById("chartMeta");
    const summary = document.getElementById("chartSummary");
    const legend = document.getElementById("chartLegend");
    if (!container || !meta || !summary) return;

    const metric = getChartMetricConfig(state.metric);
    const snapshots = (state.data && state.data.snapshots) || [];
    if (!snapshots.length) {
      container.innerHTML = '<div class="empty">まだ資産推移データがありません。</div>';
      meta.textContent = "スナップショット待ち";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    const filtered = filterSnapshots(snapshots, state.range);
    if (!filtered.length) {
      container.innerHTML = '<div class="empty">この期間のデータがありません。</div>';
      meta.textContent = "期間内データなし";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    const points = filtered
      .map(function (row) {
        return {
          date: row.date,
          value: metric.value(row),
          capital: toNumber(row.trueCapital)
        };
      })
      .filter(function (row) {
        return row.date && isFiniteNumber(row.value);
      });

    if (!points.length) {
      container.innerHTML = '<div class="empty">グラフを描画できませんでした。</div>';
      meta.textContent = "描画失敗";
      summary.innerHTML = "";
      if (legend) legend.innerHTML = "";
      return;
    }

    const values = points.map(function (p) { return p.value; });
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);

    if (metric.overlay === "trueCapital") {
      const capitals = points.map(function (p) { return p.capital; }).filter(isFiniteNumber);
      if (capitals.length) {
        min = Math.min.apply(null, values.concat(capitals));
        max = Math.max.apply(null, values.concat(capitals));
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
      const padValue = Math.max(Math.abs(min) * 0.05, metric.unit === "percent" ? 0.01 : 1);
      min -= padValue;
      max += padValue;
    } else {
      const padValue = (max - min) * 0.08;
      min -= padValue;
      max += padValue;
    }

    const range = Math.max(max - min, metric.unit === "percent" ? 0.01 : 1);
    const width = 1000;
    const height = 320;
    const pad = { top: 24, right: 24, bottom: 38, left: 80 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const svg = [];
    svg.push('<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="Asset trend chart">');
    svg.push('<defs><linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0f5f74" stop-opacity="0.22"></stop><stop offset="100%" stop-color="#0f5f74" stop-opacity="0.02"></stop></linearGradient></defs>');

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const value = max - (range / 4) * i;
      svg.push('<line x1="' + pad.left + '" y1="' + y + '" x2="' + (width - pad.right) + '" y2="' + y + '" class="chart-grid"></line>');
      svg.push('<text x="' + (pad.left - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="chart-label">' + escapeHtml(metric.axis(value)) + "</text>");
    }

    const areaPath = buildPath(points, pad, plotW, plotH, min, range, true);
    const linePath = buildPath(points, pad, plotW, plotH, min, range, false);
    svg.push('<path d="' + areaPath + '" fill="url(#assetFill)"></path>');
    svg.push('<path d="' + linePath + '" class="chart-line"></path>');

    if (metric.overlay === "trueCapital") {
      const capitalLine = buildHorizontalLine(points, pad, plotW, plotH, min, range, function (point) {
        return point.capital;
      });
      if (capitalLine) {
        svg.push('<path d="' + capitalLine + '" class="chart-capital"></path>');
      }
    } else if (metric.overlay === "zero" && min <= 0 && max >= 0) {
      const zeroLine = buildHorizontalLine(points, pad, plotW, plotH, min, range, function () {
        return 0;
      });
      if (zeroLine) {
        svg.push('<path d="' + zeroLine + '" class="chart-capital"></path>');
      }
    }

    buildMarkers(points, pad, plotW, plotH, min, range).forEach(function (marker) {
      svg.push(marker);
    });

    getXAxisLabels(points).forEach(function (label) {
      const x = pad.left + (plotW * label.idx / Math.max(points.length - 1, 1));
      svg.push('<text x="' + x + '" y="' + (height - 12) + '" text-anchor="middle" class="chart-label">' + escapeHtml(label.text) + "</text>");
    });

    svg.push("</svg>");
    container.innerHTML = svg.join("");

    const first = points[0];
    const last = points[points.length - 1];
    const delta = last.value - first.value;
    const deltaRate = first.value ? delta / Math.abs(first.value) : 0;
    meta.textContent = metric.label + " / " + filtered[0].date + " から " + filtered[filtered.length - 1].date;
    summary.innerHTML = [
      pill("開始", metric.format(first.value)),
      pill("現在", metric.format(last.value)),
      pill(delta >= 0 ? "差分 +" + metric.format(delta) : "差分 " + metric.format(delta), null, delta >= 0 ? "good" : "warn"),
      pill(formatPercent(deltaRate), null, delta >= 0 ? "good" : "warn")
    ].join("");

    if (legend) {
      legend.innerHTML = [
        '<span class="legend-item"><span class="legend-swatch asset"></span>' + escapeHtml(metric.label) + '</span>',
        metric.overlay === "trueCapital"
          ? '<span class="legend-item"><span class="legend-swatch capital"></span>真の原資</span>'
          : '<span class="legend-item"><span class="legend-swatch zero"></span>基準線</span>'
      ].join("");
    }
  }

  function filterSnapshots(snapshots, range) {
    const sorted = snapshots
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
        const da = parseDate(a.date);
        const db = parseDate(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });

    if (range === "all") {
      return sorted;
    }

    const days = Number(range) || 30;
    const cutoff = startOfDay(new Date());
    cutoff.setDate(cutoff.getDate() - (days - 1));

    return sorted.filter(function (row) {
      const d = parseDate(row.date);
      return d && d >= cutoff;
    });
  }

  function buildPath(points, pad, plotW, plotH, min, range, area) {
    if (!points.length) return "";

    const coords = points.map(function (p, idx) {
      const x = pad.left + (plotW * idx / Math.max(points.length - 1, 1));
      const y = pad.top + plotH - ((p.value - min) / range) * plotH;
      return [x, y];
    });

    let d = "M " + coords[0][0] + " " + coords[0][1];
    for (let i = 1; i < coords.length; i++) {
      d += " L " + coords[i][0] + " " + coords[i][1];
    }

    if (area) {
      d += " L " + coords[coords.length - 1][0] + " " + (pad.top + plotH);
      d += " L " + coords[0][0] + " " + (pad.top + plotH) + " Z";
    }

    return d;
  }

  function buildHorizontalLine(points, pad, plotW, plotH, min, range, valueGetter) {
    const sample = points[0];
    const capital = toNumber(valueGetter ? valueGetter(sample) : sample && sample.capital);
    if (!isFiniteNumber(capital)) return "";
    const y = pad.top + plotH - ((capital - min) / range) * plotH;
    return "M " + pad.left + " " + y + " L " + (pad.left + plotW) + " " + y;
  }

  function buildMarkers(points, pad, plotW, plotH, min, range) {
    const out = [];
    const step = Math.max(Math.floor(points.length / 6), 1);

    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      const x = pad.left + (plotW * i / Math.max(points.length - 1, 1));
      const y = pad.top + plotH - ((p.value - min) / range) * plotH;
      out.push('<circle cx="' + x + '" cy="' + y + '" r="3.5" class="chart-dot"></circle>');
    }

    if (points.length > 1 && (points.length - 1) % step !== 0) {
      const last = points[points.length - 1];
      const x = pad.left + plotW;
      const y = pad.top + plotH - ((last.value - min) / range) * plotH;
      out.push('<circle cx="' + x + '" cy="' + y + '" r="3.5" class="chart-dot"></circle>');
    }

    return out;
  }

  function getXAxisLabels(points) {
    if (points.length <= 2) {
      return points.map(function (p, idx) {
        return { idx: idx, text: p.date };
      });
    }

    const picks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    const seen = {};

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
    if (typeof value === "number" && isFinite(value)) {
      return value;
    }
    const text = String(value == null ? "" : value).trim();
    if (!text) return NaN;
    const parsed = Number(text.replace(/%/g, "").replace(/,/g, ""));
    if (!isFinite(parsed)) return NaN;
    return parsed / 100;
  }

  function pill(text, value, tone) {
    const cls = tone ? "summary-pill " + tone : "summary-pill";
    return '<span class="' + cls + '">' + escapeHtml(text) + (value ? " " + escapeHtml(value) : "") + "</span>";
  }

  function renderSummaryList(id, rows) {
    const el = document.getElementById(id);
    if (!el) return;

    el.innerHTML = rows.map(function (pair) {
      return '<div class="summary-row"><div class="summary-key">' + escapeHtml(pair[0]) +
        '</div><div class="summary-value">' + escapeHtml(displayValue(pair[1]) || "-") + "</div></div>";
    }).join("");
  }

  function renderCardList(id, items, renderer) {
    const el = document.getElementById(id);
    if (!el) return;

    if (!items.length) {
      el.innerHTML = '<div class="empty">No data yet.</div>';
      return;
    }

    el.innerHTML = items.map(function (item) {
      return '<div class="list-item">' + renderer(item) + "</div>";
    }).join("");
  }

  function renderSimpleRows(id, rows) {
    const el = document.getElementById(id);
    if (!el) return;

    if (!rows.length) {
      el.innerHTML = '<div class="empty">No data yet.</div>';
      return;
    }

    el.innerHTML = rows.map(function (row) {
      return '<div class="list-item"><div class="list-grid">' + row.map(function (cell, idx) {
        return '<div><div class="list-k">Item ' + (idx + 1) + '</div><div class="list-v">' + escapeHtml(cell) + "</div></div>";
      }).join("") + "</div></div>";
    }).join("");
  }

  function kv(key, value) {
    return '<div><div class="list-k">' + escapeHtml(key) + '</div><div class="list-v">' + escapeHtml(displayValue(value) || "-") + "</div></div>";
  }

  function judgeClass(value) {
    const text = String(value || "");
    if (!text) return "";
    if (/\u8cb7|\u597d|\u4e0a\u6607/.test(text)) return "good";
    if (/\u6ce8\u610f|\u4e0b\u843d|\u58f2/.test(text)) return "warn";
    return "";
  }

  function setLoadingState(isLoading) {
    const button = document.getElementById("refreshButton");
    if (!button) return;

    button.disabled = isLoading;
    button.textContent = isLoading ? "…" : "↻";
  }

  function renderError(error) {
    const message = error && error.message ? error.message : String(error || "Load failed");

    const hero = document.getElementById("heroMetrics");
    if (hero) {
      hero.innerHTML =
        '<div class="metric-card"><div class="metric-label">Error</div><div class="metric-value">' +
        escapeHtml(message) + "</div></div>";
    }

    const chart = document.getElementById("chartContainer");
    if (chart) {
      chart.innerHTML = '<div class="empty">' + escapeHtml(message) + "</div>";
    }
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
    const abs = Math.abs(value);
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
    const n = Number(String(value || "").replace(/,/g, ""));
    return isFinite(n) ? n : NaN;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function parseDate(text) {
    if (!text) return null;
    const s = String(text).trim().replace(/-/g, "/");
    const parts = s.split("/");
    if (parts.length < 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : startOfDay(date);
  }

  function startOfDay(date) {
    const d = new Date(date);
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
