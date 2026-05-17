# GitHub と LINE Mini App の進め方

このリポジトリは、次の形で使う前提です。

- `gas/`: Google Apps Script に貼るコード
- `docs/`: GitHub Pages にそのまま公開するフロント

## いちばん簡単な全体像

1. Google Sheets が元データ
2. Apps Script がデータ API
3. GitHub Pages が画面
4. LINE Mini App は GitHub Pages を開く

## まずやること

### 1. GitHub に新しい repository を作る

GitHub で:

1. 右上の `+`
2. `New repository`
3. Repository name を入れる  
   例: `portfolio-line-mini-app`
4. `Public` または `Private` を選ぶ
5. `Create repository`

## 2. このフォルダを Git 管理にする

このフォルダで PowerShell を開いて、次を実行します。

```powershell
git init
git add .
git commit -m "Initial LINE Mini App scaffold"
git branch -M main
git remote add origin <あなたのGitHubリポジトリURL>
git push -u origin main
```

`<あなたのGitHubリポジトリURL>` の例:

```text
https://github.com/yourname/portfolio-line-mini-app.git
```

## 3. GitHub Pages を有効にする

GitHub の repository で:

1. `Settings`
2. 左の `Pages`
3. `Build and deployment`
4. `Source: Deploy from a branch`
5. Branch は `main`
6. Folder は `/docs`
7. `Save`

少し待つと公開 URL が出ます。たとえば:

```text
https://yourname.github.io/portfolio-line-mini-app/
```

この URL が Mini App の画面 URL になります。

## 4. Apps Script を API として公開する

Google Sheets に紐づいた Apps Script へ、`gas/` の内容を入れます。

使うファイル:

- `gas/Code.gs`
- `gas/Index.html`
- `gas/Stylesheet.html`
- `gas/JavaScript.html`
- `gas/appsscript.json`

ただし GitHub Pages を使う場合、Apps Script の `Index.html` 側は必須ではありません。  
本当に必要なのは `Code.gs` と `appsscript.json` です。

### Apps Script の設定

`gas/Code.gs` の `LIFF_ID` をあとで入れます。

```javascript
LIFF_ID: "REPLACE_WITH_YOUR_LIFF_ID"
```

### Web App としてデプロイ

1. Apps Script の右上 `デプロイ`
2. `新しいデプロイ`
3. 種類を `ウェブアプリ`
4. 実行ユーザーは目的に合わせて設定
5. アクセス権も目的に合わせて設定
6. `デプロイ`

デプロイ後の URL を控えます。

例:

```text
https://script.google.com/macros/s/xxxxxxxxxxxx/exec
```

## 5. docs/index.html を書き換える

`docs/index.html` のこの部分を差し替えます。

```html
window.PORTFOLIO_APP_CONFIG = {
  apiBaseUrl: "REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL",
  liffId: "REPLACE_WITH_YOUR_LIFF_ID"
};
```

例:

```html
window.PORTFOLIO_APP_CONFIG = {
  apiBaseUrl: "https://script.google.com/macros/s/xxxxxxxxxxxx/exec",
  liffId: "2007654321-AbCdEfGh"
};
```

書き換えたら GitHub に push します。

```powershell
git add .
git commit -m "Configure Pages and LIFF"
git push
```

## 6. LINE Developers で LIFF / Mini App を作る

LINE Developers で:

1. Provider を作る
2. Channel を作る
3. LIFF App を追加
4. Endpoint URL に GitHub Pages の URL を入れる

例:

```text
https://yourname.github.io/portfolio-line-mini-app/
```

発行された LIFF ID を `docs/index.html` と `gas/Code.gs` に入れます。

## 7. 動作確認

まずブラウザで:

1. GitHub Pages の URL を開く
2. データが出るか確認

次に API を確認:

```text
https://script.google.com/macros/s/xxxxxxxxxxxx/exec?api=portfolio
```

これで JSON が返れば API は動いています。

## トラブル時の見方

### 画面が出るがデータが出ない

- `docs/index.html` の `apiBaseUrl` が間違っている
- Apps Script の公開権限が足りない

### LINE では開くが真っ白

- LIFF ID が未設定
- Endpoint URL が GitHub Pages ではない

### GitHub Pages が 404

- `Settings > Pages` で `/docs` が選ばれていない
- push 後の反映待ち

## おすすめ運用

- 見た目の変更は `docs/`
- シート構造変更への追従は `gas/Code.gs`

こう分けると、あとでかなり楽です。
