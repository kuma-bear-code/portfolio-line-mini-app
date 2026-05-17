(function () {
  const state = {
    data: null,
    range: "30"
  };

  const moneyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindTabs();
    bindRanges();

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
        document.querySelectorAll(".range-btn").forEach(function (btn) {
          btn.classList.remove("is-active");
        });
        button.classList.add("is-active");
        renderChart();
      });
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
    if (!container || !meta || !summary) return;

    const snapshots = (state.data && state.data.snapshots) || [];
    if (!snapshots.length) {
      container.innerHTML = '<div class="empty">No asset history yet.</div>';
      meta.textContent = "Waiting for snapshots";
      summary.innerHTML = "";
      return;
    }

    const filtered = filterSnapshots(snapshots, state.range);
    if (!filtered.length) {
      container.innerHTML = '<div class="empty">No data in this range.</div>';
      meta.textContent = "No data in range";
      summary.innerHTML = "";
      return;
    }

    const points = filtered
      .map(function (row) {
        return {
          date: row.date,
          asset: toNumber(row.totalAsset),
          capital: toNumber(row.trueCapital)
        };
      })
      .filter(function (row) {
        return row.date && isFiniteNumber(row.asset);
      });

    if (!points.length) {
      container.innerHTML = '<div class="empty">Unable to render the chart.</div>';
      meta.textContent = "Render failed";
      summary.innerHTML = "";
      return;
    }

    const assetValues = points.map(function (p) { return p.asset; });
    const capitalValues = points.map(function (p) { return p.capital; }).filter(isFiniteNumber);
    const allValues = assetValues.concat(capitalValues);
    let min = Math.min.apply(null, allValues);
    let max = Math.max.apply(null, allValues);

    if (!isFinite(min) || !isFinite(max)) {
      container.innerHTML = '<div class="empty">Unable to calculate chart bounds.</div>';
      meta.textContent = "Render failed";
      summary.innerHTML = "";
      return;
    }

    if (min === max) {
      const padValue = Math.max(Math.abs(min) * 0.05, 1);
      min -= padValue;
      max += padValue;
    } else {
      const padValue = (max - min) * 0.08;
      min -= padValue;
      max += padValue;
    }

    const range = Math.max(max - min, 1);
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
      svg.push('<text x="' + (pad.left - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="chart-label">' + escapeHtml(formatCompact(value)) + "</text>");
    }

    const areaPath = buildPath(points, pad, plotW, plotH, min, range, true);
    const linePath = buildPath(points, pad, plotW, plotH, min, range, false);
    svg.push('<path d="' + areaPath + '" fill="url(#assetFill)"></path>');
    svg.push('<path d="' + linePath + '" class="chart-line"></path>');

    const capitalLine = buildHorizontalLine(points, pad, plotW, plotH, min, range);
    if (capitalLine) {
      svg.push('<path d="' + capitalLine + '" class="chart-capital"></path>');
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
    const change = last.asset - first.asset;
    const changeRate = first.asset ? change / first.asset : 0;
    meta.textContent = filtered[0].date + " to " + filtered[filtered.length - 1].date;
    summary.innerHTML = [
      pill("Start", formatNumber(first.asset)),
      pill("Current", formatNumber(last.asset)),
      pill(change >= 0 ? "Change +" + formatNumber(change) : "Change " + formatNumber(change), null, change >= 0 ? "good" : "warn"),
      pill(formatPercent(changeRate), null, change >= 0 ? "good" : "warn")
    ].join("");
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
      const y = pad.top + plotH - ((p.asset - min) / range) * plotH;
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

  function buildHorizontalLine(points, pad, plotW, plotH, min, range) {
    const capital = toNumber(points[0] && points[0].capital);
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
      const y = pad.top + plotH - ((p.asset - min) / range) * plotH;
      out.push('<circle cx="' + x + '" cy="' + y + '" r="3.5" class="chart-dot"></circle>');
    }

    if (points.length > 1 && (points.length - 1) % step !== 0) {
      const last = points[points.length - 1];
      const x = pad.left + plotW;
      const y = pad.top + plotH - ((last.asset - min) / range) * plotH;
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
    if (abs >= 1000000000) return (value / 1000000000).toFixed(1) + "B";
    if (abs >= 1000000) return (value / 1000000).toFixed(1) + "M";
    if (abs >= 1000) return (value / 1000).toFixed(1) + "k";
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
