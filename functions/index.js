import { collect } from "../lib/collect.js";

// GET / : 静的HTMLに「ページを開いたとき(ナビゲーション)のリクエスト」の情報を埋め込んで返す。
// /api/info を別途fetchすると Referer などが「このページ自身」になってしまうため、
// 本物のナビゲーションリクエストのヘッダー(Referer, Cookie, sec-fetch-* など)をここで拾う。
export async function onRequestGet({ request, env }) {
  const asset = await env.ASSETS.fetch(request);
  const data = JSON.stringify(collect(request)).replace(/</g, "\\u003c");

  const res = new HTMLRewriter()
    .on("script#server-data", {
      element(el) {
        el.setInnerContent(data, { html: true });
      },
    })
    .transform(asset);

  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  out.headers.set("x-robots-tag", "noindex");
  return out;
}
