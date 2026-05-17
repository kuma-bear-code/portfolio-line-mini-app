(function () {
  const state = { data: null };

  document.addEventListener("DOMContentLoaded", function () {
    bindTabs();
    document.getElementById("refreshButton").addEventListener("click", loadApp);
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
        document.querySelector('[data-panel="' + button.dataset.tab + '"]').classList.add("is-active");
      });
    });
  }

  function loadApp() {
    setLoadingState(true);
    fetchPortfolioData()
      .then(function (data) {
        state.data = data;
        return initLiffIfNeeded((window.PORTFOLIO_APP_CONFIG || {}).liffId).then(function () {
          renderApp(data);
        });
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
      return Promise.reject(new Error("Apps Script Web App URL を設定してください。"));
    }

    return jsonp(baseUrl + (baseUrl.indexOf("?") >= 0 ? "&" : "?") + "api=portfolio");
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      const callbackName = "__portfolioCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const script = document.createElement("script");

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("データ取得に失敗しました。"));
      };

      script.src = url + "&callback=" + callbackName;
      document.body.appendChild(script);

      function cleanup() {
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
      }
    });
  }

  function initLiffIfNeeded(liffId) {
    if (!window.liff || !liffId || liffId.indexOf("REPLACE_WITH") >= 0) {
      return Promise.resolve();
    }
    return window.liff.init({ liffId: liffId });
  }

  function renderApp(data) {
    renderHero(data.home);
    renderHome(data.home);
    renderHoldings(data.holdings || []);
    renderWatchlist(data.watchlist || []);
    renderWeekly(data.weekly || {});
  }

  function renderHero(home) {
    const metrics = [
      ["総資産", home.totalAsset],
      ["増減額", home.gainAmount],
      ["増減率", home.gainRate],
      ["保有銘柄数", home.holdingCount]
    ];
    document.getElementById("heroMetrics").innerHTML = metrics.map(function (pair) {
      return '<div class="metric-card"><div class="metric-label">' + escapeHtml(pair[0]) +
        '</div><div class="metric-value">' + escapeHtml(pair[1] || "-") + "</div></div>";
    }).join("");
  }

  function renderHome(home) {
    renderSummaryList("homeSummary", [
      ["最終更新", home.updatedAt],
      ["総資産", home.totalAsset],
      ["真の原資", home.trueCapital],
      ["増減額", home.gainAmount],
      ["増減率", home.gainRate],
      ["現金残高", home.cash],
      ["保有銘柄数", home.holdingCount],
      ["最大構成", home.maxWeight],
      ["監視API", home.watchApiStatus]
    ]);
  }

  function renderHoldings(items) {
    renderCardList("holdingsList", items, function (item) {
      return ''
        + '<div class="list-item-title"><div><div class="list-item-name">' + escapeHtml(item.name)
        + '</div><div class="list-item-code">' + escapeHtml(item.code)
        + '</div></div><span class="pill">' + escapeHtml(item.type) + '</span></div>'
        + '<div class="list-grid">'
        + kv("数量", item.qty)
        + kv("評価額", item.valueJpy)
        + kv("価格", item.priceJpy)
        + kv("証券会社", item.broker)
        + '</div>';
    });
  }

  function renderWatchlist(items) {
    renderCardList("watchlistList", items, function (item) {
      return ''
        + '<div class="list-item-title"><div><div class="list-item-name">' + escapeHtml(item.name)
        + '</div><div class="list-item-code">' + escapeHtml(item.code)
        + '</div></div><span class="pill ' + judgeClass(item.autoJudge) + '">'
        + escapeHtml(item.autoJudge || item.manualHint || "監視中") + '</span></div>'
        + '<div class="list-grid">'
        + kv("テーマ", item.theme)
        + kv("現在価格", item.currentPrice)
        + kv("開始後騰落率", item.changeRate)
        + kv("目標買付額", item.targetBudget)
        + kv("差額", item.diff)
        + kv("レビュー要点", item.reviewPoint || item.manualHint)
        + '</div>';
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

  function renderSummaryList(id, rows) {
    const el = document.getElementById(id);
    el.innerHTML = rows.map(function (pair) {
      return '<div class="summary-row"><div class="summary-key">' + escapeHtml(pair[0]) +
        '</div><div class="summary-value">' + escapeHtml(pair[1] || "-") + '</div></div>';
    }).join("");
  }

  function renderCardList(id, items, renderer) {
    const el = document.getElementById(id);
    if (!items.length) {
      el.innerHTML = '<div class="empty">表示できるデータがまだありません。</div>';
      return;
    }
    el.innerHTML = items.map(function (item) {
      return '<div class="list-item">' + renderer(item) + '</div>';
    }).join("");
  }

  function renderSimpleRows(id, rows) {
    const el = document.getElementById(id);
    if (!rows.length) {
      el.innerHTML = '<div class="empty">まだデータがありません。</div>';
      return;
    }
    el.innerHTML = rows.map(function (row) {
      return '<div class="list-item"><div class="list-grid">' + row.map(function (cell, idx) {
        return '<div><div class="list-k">項目 ' + (idx + 1) + '</div><div class="list-v">' + escapeHtml(cell) + '</div></div>';
      }).join("") + '</div></div>';
    }).join("");
  }

  function kv(key, value) {
    return '<div><div class="list-k">' + escapeHtml(key) + '</div><div class="list-v">' + escapeHtml(value || "-") + '</div></div>';
  }

  function judgeClass(value) {
    if (!value) return "";
    if (value.indexOf("押し目") >= 0) return "good";
    if (value.indexOf("高ボラ") >= 0 || value.indexOf("注意") >= 0) return "warn";
    return "";
  }

  function setLoadingState(isLoading) {
    const button = document.getElementById("refreshButton");
    button.disabled = isLoading;
    button.textContent = isLoading ? "…" : "↻";
  }

  function renderError(error) {
    document.getElementById("heroMetrics").innerHTML =
      '<div class="metric-card"><div class="metric-label">読み込み失敗</div><div class="metric-value">'
      + escapeHtml(error.message || String(error)) + "</div></div>";
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
