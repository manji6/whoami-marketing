import { collect } from "../lib/collect.js";
// 静的ファイルはWorkerに同梱する (小規模サイトのため。Text modulesとしてビルド時に埋め込まれる)
import indexHtml from "../public/index.html";
import styleCss from "../public/style.css";
import appJs from "../public/app.js";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-robots-tag": "noindex",
};
const NO_STORE = { "cache-control": "no-store" };
// CSS/JSは常に再検証させる (更新が即座に反映されるように)
const NO_CACHE = { "cache-control": "no-cache" };

const respond = (body, type, extra = {}) =>
  new Response(body, { headers: { "content-type": type, ...SECURITY_HEADERS, ...extra } });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isRead = request.method === "GET" || request.method === "HEAD";
    if (!isRead) return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });

    switch (url.pathname) {
      // サーバー側で取得できた情報をJSONで返す
      case "/api/info":
        return respond(JSON.stringify(collect(request), null, 2), "application/json; charset=utf-8", NO_STORE);

      // 「ページを開いたとき(ナビゲーション)のリクエスト」の情報をHTMLへ埋め込む。
      // /api/info を別途fetchすると Referer などが「このページ自身」になってしまうため、
      // 本物のナビゲーションリクエストのヘッダー(Referer, Cookie, sec-fetch-* など)をここで拾う。
      case "/":
      case "/index.html": {
        const data = JSON.stringify(collect(request)).replace(/</g, "\\u003c");
        const res = new HTMLRewriter()
          .on("script#server-data", {
            element(el) {
              el.setInnerContent(data, { html: true });
            },
          })
          .transform(respond(indexHtml, "text/html; charset=utf-8", NO_STORE));
        return res;
      }

      case "/style.css":
        return respond(styleCss, "text/css; charset=utf-8", NO_CACHE);
      case "/app.js":
        return respond(appJs, "text/javascript; charset=utf-8", NO_CACHE);

      default:
        return new Response("Not Found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
        });
    }
  },
};
