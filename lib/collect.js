// リクエストを受けたサーバー側(Cloudflare edge)で取得できる情報を集める。
// functions/index.js (HTMLへ埋め込み) と functions/api/info.js (JSON API) の両方から使う。

// 表示時に値をマスクしたいヘッダーは無いが、念のため明示的に除外できるようにしておく。
const HIDDEN_HEADERS = new Set([]);

function parseCookieHeader(header) {
  if (!header) return [];
  return header
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      return i < 0
        ? { name: pair, value: "" }
        : { name: pair.slice(0, i), value: pair.slice(i + 1) };
    });
}

export function collect(request) {
  const url = new URL(request.url);
  const cf = request.cf || {};

  const headers = {};
  for (const [k, v] of request.headers) {
    if (!HIDDEN_HEADERS.has(k)) headers[k] = v;
  }

  const query = [];
  for (const [k, v] of url.searchParams) query.push({ name: k, value: v });

  // request.cf はプランや設定によって有無が変わる。値が無いものは undefined のまま落とす。
  const {
    botManagement,
    tlsClientAuth, // 証明書系は不要
    tlsExportedAuthenticator,
    ...cfRest
  } = cf;

  return {
    generatedAt: new Date().toISOString(),
    request: {
      method: request.method,
      url: request.url,
      host: url.host,
      path: url.pathname,
      query,
      hash: null, // fragment はサーバーに届かない(クライアント側で表示)
    },
    network: {
      ip: request.headers.get("cf-connecting-ip") || null,
      ipVersion: (request.headers.get("cf-connecting-ip") || "").includes(":") ? "IPv6" : "IPv4",
      country: cf.country ?? null,
      isEUCountry: cf.isEUCountry ?? null,
      continent: cf.continent ?? null,
      region: cf.region ?? null,
      regionCode: cf.regionCode ?? null,
      city: cf.city ?? null,
      postalCode: cf.postalCode ?? null,
      latitude: cf.latitude ?? null,
      longitude: cf.longitude ?? null,
      timezone: cf.timezone ?? null,
      metroCode: cf.metroCode ?? null,
      asn: cf.asn ?? null,
      asOrganization: cf.asOrganization ?? null,
      colo: cf.colo ?? null,
      httpProtocol: cf.httpProtocol ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      tlsCipher: cf.tlsCipher ?? null,
      clientTcpRtt: cf.clientTcpRtt ?? null,
      clientAcceptEncoding: cf.clientAcceptEncoding ?? null,
      requestPriority: cf.requestPriority ?? null,
    },
    bot: botManagement
      ? {
          score: botManagement.score,
          verifiedBot: botManagement.verifiedBot,
          staticResource: botManagement.staticResource,
          corporateProxy: botManagement.corporateProxy,
          ja3Hash: botManagement.ja3Hash,
          ja4: botManagement.ja4,
        }
      : null,
    // サーバーが受け取ったCookieヘッダー(HttpOnly Cookieもここには出る)
    cookies: parseCookieHeader(request.headers.get("cookie")),
    headers,
    // cf のうち上記で個別に拾っていない項目(将来の追加フィールド確認用)
    cfExtra: cfRest,
  };
}
