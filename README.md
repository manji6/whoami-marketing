# whoami-marketing

ページを開いた時点で取得できるマーケティング関連情報を一覧表示するサイトです。
計測タグの動作確認、流入元の切り分け、広告パラメータの引き継ぎチェックを想定しています。

## 表示する情報

- **流入元・リファラ**: `document.referrer` とサーバー受信の `Referer` ヘッダーの比較、流入チャネルの簡易推定、ナビゲーション種別
- **URLパラメータ**: UTM、gclid / fbclid / msclkid などの広告クリックIDを判別して表示
- **Cookie**: ブラウザ側 (`document.cookie`) とサーバー受信の `Cookie` ヘッダーを並べて表示。`_ga` `_fbp` `_gcl_*` などは意味と中身 (Client ID・作成日時など) を解読
- **接続情報 (Cloudflare)**: IP、国・地域・市区町村、ASN、データセンター、TLS/HTTPバージョン など
- **照合**: タイムゾーン・言語・User-Agent のブラウザ側とサーバー側の差分
- **ブラウザ/デバイス**: UA Client Hints、画面、言語、接続種別、GPC / DNT など
- **全リクエストヘッダー** (`/api/info` でサーバー側情報をJSONでも取得可能)

値は表示のみで、保存・外部送信は行いません。

**EXPORT JSON**: 画面の全項目(生データ+解釈付き)を1つのJSONファイルとしてダウンロードできます。ブラウザ内で生成され、サーバーには送信されません。ファイルにはIP・Cookie値・Client IDなどが含まれるため、`_meta.notice` に共有時の注意を記載しています。

## 構成

```
public/            静的ファイル (HTML/CSS/JS, _headers)
src/worker.js      "/" にナビゲーション時のリクエスト情報をHTMLへ埋め込む / GET /api/info (サーバー側情報のJSON)
lib/collect.js     サーバー側で情報を集める処理
wrangler.toml      Cloudflare Workers (Static Assets) 設定。独自ドメイン whoami.amanohashi.date
```

## ローカル実行

```bash
npm install
npm run dev   # http://localhost:8787
```

ローカルでは `request.cf` の値 (国・ASN・Bot等) はダミーです。

## デプロイ (Cloudflare Workers)

公開URL: https://whoami.amanohashi.date

```bash
npx wrangler deploy
```

GitHub Actions (`.github/workflows/deploy.yml`) は、リポジトリの Secrets に `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit など) と `CLOUDFLARE_ACCOUNT_ID` を設定すると、`main` への push で自動デプロイします。未設定の場合はデプロイ手順をスキップします。
