# LINE Mini App for 株管理_ポートフォリオ

このリポジトリは、既存の Google Sheets ポートフォリオを LINE Mini App で見られるようにする最小構成です。

## 構成

- 元データ: Google Sheets
- API: Google Apps Script Web App
- フロント: GitHub Pages
- LINE Mini App: LIFF

## ディレクトリ構成

- `gas/`: Apps Script に入れるコード
- `docs/`: GitHub Pages にそのまま公開する静的フロント
- `GUIDE_JA.md`: 日本語の丁寧なセットアップ手順
- `apps-script/`: Apps Script を機能別に分割した貼り付け用コード

## まず読むもの

- [GUIDE_JA.md](./GUIDE_JA.md)
- Apps Script を分割して貼るなら [apps-script/01_Code.gs](./apps-script/01_Code.gs) から順に見てください

## 補足

- 初版は読み取り専用です
- 監視銘柄、現在保有、週次レビューをスマホ向けに見るところから始めています
- 将来的に通知、メモ保存、ウォッチ条件アラートにも伸ばせます
