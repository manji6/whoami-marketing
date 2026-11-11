/* Whoami Marketing
 * ページを開いた時点で取得できる情報を一覧表示する。
 * 値には攻撃者が自由に作れるもの(URLパラメータ・Cookie・Referer等)が含まれるため、
 * DOMは必ず textContent / createElement で組み立てる(innerHTMLにデータを入れない)。
 */
(() => {
  "use strict";

  // ---------- DOM helpers ----------
  const h = (tag, props, ...children) => {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  const isEmpty = (v) => v === null || v === undefined || v === "";
  const fmtDate = (ms) => {
    const d = new Date(ms);
    return isNaN(d) ? String(ms) : d.toLocaleString("ja-JP", { hour12: false });
  };

  // 1行 = 項目名 / 値 / 補足
  const row = (key, value, desc) => {
    const td = h("td");
    if (isEmpty(value)) {
      td.append(h("span", { class: "none" }, "— 取得できず"));
    } else if (value instanceof Node) {
      td.append(value);
    } else {
      td.append(h("code", { class: "val", title: "クリックでコピー" }, String(value)));
    }
    if (desc) td.append(h("span", { class: "desc" }, desc));
    return h("tr", null, h("th", null, key), td);
  };

  const table = (rows) => h("table", null, h("tbody", null, rows));
  const card = (title, opts, ...body) =>
    h(
      "section",
      { class: "card" },
      h("h2", null, title, opts.badge && h("span", { class: `badge ${opts.badgeClass || ""}` }, opts.badge), opts.sub && h("small", null, opts.sub)),
      opts.note && h("p", { class: "note" }, opts.note),
      body
    );
  const empty = (msg) => h("div", { class: "empty" }, msg);

  // ---------- 辞書: 広告・計測パラメータ ----------
  const PARAM_DICT = {
    utm_source: "UTM: 参照元 (例: google, newsletter)",
    utm_medium: "UTM: メディア (例: cpc, email)",
    utm_campaign: "UTM: キャンペーン名",
    utm_term: "UTM: 検索キーワード",
    utm_content: "UTM: 広告・リンクの識別",
    utm_id: "UTM: キャンペーンID",
    gclid: "Google広告 クリックID",
    gbraid: "Google広告 クリックID (iOS アプリ→Web)",
    wbraid: "Google広告 クリックID (Web→アプリ)",
    gad_source: "Google広告 ソース識別",
    gad_campaignid: "Google広告 キャンペーンID",
    dclid: "Google Display & Video 360 クリックID",
    _gl: "GA クロスドメイン計測用リンカー",
    fbclid: "Meta (Facebook/Instagram) クリックID",
    igshid: "Instagram 共有ID",
    msclkid: "Microsoft広告 クリックID",
    yclid: "Yahoo!広告/Yandex クリックID",
    yahoo_ydn_conv_io: "Yahoo!広告 コンバージョン計測",
    ttclid: "TikTok クリックID",
    twclid: "X (Twitter) クリックID",
    li_fat_id: "LinkedIn クリックID",
    rdt_cid: "Reddit クリックID",
    epik: "Pinterest クリックID",
    ScCid: "Snapchat クリックID",
    mc_cid: "Mailchimp キャンペーンID",
    mc_eid: "Mailchimp メールアドレスID",
    _hsenc: "HubSpot メール計測",
    _hsmi: "HubSpot メール計測",
  };
  const paramDesc = (name) => {
    if (PARAM_DICT[name]) return PARAM_DICT[name];
    if (/^utm_/i.test(name)) return "UTM系パラメータ";
    return null;
  };
  const isTrackingParam = (name) => !!paramDesc(name);

  // ---------- 辞書: Cookie ----------
  const ts = (sec) => fmtDate(Number(sec) * 1000);
  const COOKIE_DICT = [
    {
      re: /^_ga$/,
      label: "Google アナリティクス: クライアントID",
      decode: (v) => {
        const m = /^GA\d\.\d+\.(\d+)\.(\d+)$/.exec(v);
        return m ? `Client ID: ${m[1]}.${m[2]} / 初回訪問: ${ts(m[2])}` : null;
      },
    },
    {
      re: /^_ga_[A-Z0-9]+$/,
      label: "GA4: セッション情報 (測定IDごと)",
      decode: (v) => {
        let m = /^GS1\.\d+\.(\d+)\.(\d+)\./.exec(v);
        if (m) return `セッション開始: ${ts(m[1])} / セッション数: ${m[2]}`;
        m = /^GS2\.\d+\.s(\d+)\$o(\d+)/.exec(v);
        if (m) return `セッション開始: ${ts(m[1])} / セッション数: ${m[2]}`;
        return null;
      },
    },
    { re: /^_gid$/, label: "Google アナリティクス(UA): 24時間のユーザー識別" },
    { re: /^_gat/, label: "Google アナリティクス(UA): リクエスト頻度制限" },
    {
      re: /^_gcl_au$/,
      label: "Google広告: コンバージョンリンカー",
      decode: (v) => {
        const m = /^\d+\.\d+\.(\d+)\.(\d+)$/.exec(v) || /^\d+\.(\d+)\.(\d+)$/.exec(v);
        return m ? `作成: ${ts(m[2])}` : null;
      },
    },
    {
      re: /^_gcl_aw$/,
      label: "Google広告: gclid保持 (コンバージョンリンカー)",
      decode: (v) => {
        const m = /^GCL\.(\d+)\.(.+)$/.exec(v);
        return m ? `gclid: ${m[2]} / 保存: ${ts(m[1])}` : null;
      },
    },
    { re: /^_gcl_(dc|gb|gf|ag)$/, label: "Google広告: コンバージョンリンカー関連" },
    {
      re: /^_gac_/,
      label: "Google広告: キャンペーン情報 (GA連携)",
      decode: (v) => {
        const m = /^\d\.(\d+)\.(.+)$/.exec(v);
        return m ? `gclid: ${m[2]} / 保存: ${ts(m[1])}` : null;
      },
    },
    { re: /^FPID$|^FPLC$|^FPAU$|^FPGSID$/, label: "Google タグ: ファーストパーティ(サーバーサイド)識別子" },
    { re: /^_dc_gtm_/, label: "Google タグマネージャ: 頻度制限" },
    {
      re: /^_fbp$/,
      label: "Meta ピクセル: ブラウザID",
      decode: (v) => {
        const m = /^fb\.\d+\.(\d+)\.(\d+)$/.exec(v);
        return m ? `作成: ${fmtDate(Number(m[1]))}` : null;
      },
    },
    {
      re: /^_fbc$/,
      label: "Meta ピクセル: クリックID (fbclid保持)",
      decode: (v) => {
        const m = /^fb\.\d+\.(\d+)\.(.+)$/.exec(v);
        return m ? `fbclid: ${m[2]} / 保存: ${fmtDate(Number(m[1]))}` : null;
      },
    },
    { re: /^_uetsid$|^_uetvid$|^_uetmsclkid$/, label: "Microsoft広告 UETタグ" },
    { re: /^_clck$|^_clsk$|^CLID$|^MUID$/, label: "Microsoft Clarity / Bing" },
    { re: /^_ttp$|^_tt_enable_cookie$|^ttclid$/, label: "TikTok ピクセル" },
    { re: /^_scid$|^_scid_r$|^sc_at$|^_sctr$/, label: "Snapchat ピクセル" },
    { re: /^_pin_unauth$|^_pinterest_/, label: "Pinterest タグ" },
    { re: /^_rdt_uuid$|^_rdt_/, label: "Reddit ピクセル" },
    { re: /^li_fat_id$|^_lipt$|^lidc$|^bcookie$|^li_sugr$/, label: "LinkedIn Insight タグ" },
    { re: /^_twclid$|^personalization_id$|^muc_ads$/, label: "X (Twitter) タグ" },
    { re: /^_yjsu_yjad$|^_ycl_yjad$|^yjr_/, label: "Yahoo!広告 計測" },
    { re: /^_hjSessionUser_|^_hjSession_|^_hjid$|^_hjFirstSeen$/, label: "Hotjar" },
    { re: /^hubspotutk$|^__hstc$|^__hssc$|^__hssrc$/, label: "HubSpot" },
    { re: /^ajs_anonymous_id$|^ajs_user_id$/, label: "Segment: 匿名ID/ユーザーID" },
    { re: /^amplitude_id_|^AMP_/, label: "Amplitude" },
    { re: /^mp_.*_mixpanel$/, label: "Mixpanel" },
    { re: /^__utm[a-z]$/, label: "旧Google アナリティクス (ga.js/UA)" },
    { re: /^_gaexp/, label: "Google オプティマイズ/実験" },
    { re: /^optimizelyEndUserId$/, label: "Optimizely" },
    { re: /^OptanonConsent$|^OptanonAlertBoxClosed$/, label: "OneTrust: 同意管理 (CMP)" },
    { re: /^CookieConsent$|^CookieScriptConsent$|^cookieyes-consent$|^euconsent-v2$|^cmplz_/, label: "同意管理 (CMP)" },
    { re: /^IDE$|^test_cookie$|^DSID$|^__gads$|^__gpi$/, label: "Google広告/DoubleClick" },
    { re: /^_cfuvid$|^__cf_bm$|^cf_clearance$|^__cflb$/, label: "Cloudflare" },
    { re: /^PHPSESSID$|^JSESSIONID$|^connect\.sid$|^ASP\.NET_SessionId$|^laravel_session$/, label: "サイトのセッションCookie" },
  ];
  const cookieInfo = (name, value) => {
    for (const d of COOKIE_DICT) {
      if (d.re.test(name)) {
        let decoded = null;
        try { decoded = d.decode ? d.decode(value) : null; } catch { /* noop */ }
        return { label: d.label, decoded };
      }
    }
    return null;
  };

  // ---------- 辞書: 流入元の推定 ----------
  const REFERRER_RULES = [
    [/(^|\.)google\.[a-z.]+$/, "検索 (Google)"],
    [/(^|\.)bing\.com$/, "検索 (Bing)"],
    [/(^|\.)yahoo\.(co\.jp|com)$/, "検索 (Yahoo!)"],
    [/(^|\.)duckduckgo\.com$/, "検索 (DuckDuckGo)"],
    [/(^|\.)baidu\.com$/, "検索 (Baidu)"],
    [/(^|\.)ecosia\.org$/, "検索 (Ecosia)"],
    [/(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$|^lm\.facebook\.com$/, "SNS (Facebook)"],
    [/(^|\.)instagram\.com$|^l\.instagram\.com$/, "SNS (Instagram)"],
    [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "SNS (X/Twitter)"],
    [/(^|\.)youtube\.com$|^youtu\.be$/, "動画 (YouTube)"],
    [/(^|\.)linkedin\.com$|^lnkd\.in$/, "SNS (LinkedIn)"],
    [/(^|\.)line\.me$|^line\.naver\.jp$/, "SNS (LINE)"],
    [/(^|\.)tiktok\.com$/, "SNS (TikTok)"],
    [/(^|\.)pinterest\.[a-z.]+$/, "SNS (Pinterest)"],
    [/(^|\.)reddit\.com$/, "SNS (Reddit)"],
    [/(^|\.)note\.com$|(^|\.)qiita\.com$|(^|\.)zenn\.dev$|(^|\.)hatena\.ne\.jp$/, "メディア/ブログ"],
    [/(^|\.)mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|(^|\.)mail\.yahoo\./, "メール (Webメール)"],
    [/(^|\.)slack\.com$|(^|\.)notion\.so$/, "ツール内リンク"],
  ];
  const guessChannel = (referrer, params) => {
    const medium = (params.utm_medium || "").toLowerCase();
    if (params.gclid || params.gbraid || params.wbraid || /^(cpc|ppc|paid|paidsearch)/.test(medium)) return "広告 (有料)";
    if (params.fbclid || params.msclkid || params.ttclid || params.twclid || params.yclid) return "広告/SNS (クリックIDあり)";
    if (medium === "email" || params.mc_cid) return "メール";
    if (params.utm_source) return `UTM指定 (${params.utm_source})`;
    if (!referrer) return "直接 / 不明 (リファラなし)";
    let host;
    try { host = new URL(referrer).hostname.toLowerCase(); } catch { return "不明 (リファラ解析不可)"; }
    if (host === location.hostname) return "サイト内遷移";
    for (const [re, name] of REFERRER_RULES) if (re.test(host)) return name;
    return `参照サイト (${host})`;
  };

  // ---------- 収集 ----------
  const readServer = () => {
    try { return JSON.parse(document.getElementById("server-data").textContent); } catch { return null; }
  };

  const parseParams = () => {
    const list = [];
    new URLSearchParams(location.search).forEach((v, k) => list.push({ name: k, value: v, from: "query" }));
    const hash = location.hash.replace(/^#\/?/, "");
    if (hash.includes("=")) {
      new URLSearchParams(hash).forEach((v, k) => list.push({ name: k, value: v, from: "hash" }));
    }
    return list;
  };

  const parseDocCookie = () =>
    document.cookie
      ? document.cookie.split(/;\s*/).filter(Boolean).map((p) => {
          const i = p.indexOf("=");
          return i < 0 ? { name: p, value: "" } : { name: p.slice(0, i), value: p.slice(i + 1) };
        })
      : [];

  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

  const getUAData = async () => {
    const u = navigator.userAgentData;
    if (!u) return null;
    const out = { brands: (u.brands || []).map((b) => `${b.brand} ${b.version}`).join(", "), mobile: u.mobile, platform: u.platform };
    try {
      const he = await u.getHighEntropyValues(["architecture", "bitness", "model", "platformVersion", "uaFullVersion", "fullVersionList", "wow64"]);
      out.architecture = he.architecture;
      out.bitness = he.bitness;
      out.model = he.model;
      out.platformVersion = he.platformVersion;
      out.uaFullVersion = he.uaFullVersion;
    } catch { /* 許可されない場合あり */ }
    return out;
  };

  const mm = (q) => { try { return window.matchMedia(q).matches; } catch { return false; } };

  const getNav = () => {
    const n = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (!n) return null;
    return {
      type: n.type,
      redirectCount: n.redirectCount,
      protocol: n.nextHopProtocol,
      transferSize: n.transferSize,
      ttfb: Math.round(n.responseStart - n.requestStart),
      dcl: Math.round(n.domContentLoadedEventEnd),
      load: n.loadEventEnd ? Math.round(n.loadEventEnd) : null,
    };
  };

  const storageKeys = (s) => { try { return Object.keys(s); } catch { return null; } };

  // ---------- セクション描画 ----------
  const tfmt = (v) => (v === true ? "はい" : v === false ? "いいえ" : v);

  function sectionSummary(S, params, referrer, docCookies, channel) {
    const n = S && S.network;
    const ga = docCookies.find((c) => c.name === "_ga");
    const gaId = ga && /^GA\d\.\d+\.(\d+\.\d+)$/.exec(ga.value);
    const tracking = params.filter((p) => isTrackingParam(p.name)).length;
    const known = docCookies.filter((c) => cookieInfo(c.name, c.value)).length;
    const stat = (k, v) => h("div", { class: "stat" }, h("div", { class: "k" }, k), h("div", { class: `v${isEmpty(v) ? " none" : ""}` }, isEmpty(v) ? "取得できず" : v));
    return h(
      "div",
      { class: "summary" },
      stat("IPアドレス", n && n.ip),
      stat("推定所在地", n && [n.country, n.region, n.city].filter(Boolean).join(" / ")),
      stat("流入元 (推定)", channel),
      stat("リファラ", referrer || "なし"),
      stat("広告・UTMパラメータ", `${tracking} 件`),
      stat("GA Client ID", gaId ? gaId[1] : null),
      stat("計測系Cookie (判別済み)", `${known} / ${docCookies.length} 件`)
    );
  }

  function sectionReferrer(S, referrer, channel) {
    const serverRef = S && S.headers && S.headers["referer"];
    const same = (referrer || "") === (serverRef || "");
    const rows = [
      row("流入元の推定", channel, "リファラ・UTM・クリックIDからの簡易推定です"),
      row("document.referrer (ブラウザ側)", referrer || "(空)", "遷移元URL。空の場合は直接流入、ブックマーク、https→httpの遷移、Referrer-Policyによる抑制など"),
      row("Referer ヘッダー (サーバー側)", serverRef || "(空)", "サーバーが受け取ったナビゲーション時のヘッダー値"),
    ];
    let originOnly = null;
    if (referrer) {
      try {
        const u = new URL(referrer);
        if (u.pathname === "/" && !u.search) originOnly = "オリジンのみ (遷移元のReferrer-Policyにより、パスやクエリが除去されている可能性があります)";
      } catch { /* noop */ }
    }
    if (originOnly) rows.push(row("リファラの粒度", originOnly));
    rows.push(row("クライアントとサーバーの一致", same ? "一致" : "不一致", same ? null : "ブラウザ拡張やリダイレクトで差が出ることがあります"));
    if (history.length != null) rows.push(row("履歴の長さ (history.length)", history.length));
    const nav = getNav();
    if (nav) {
      rows.push(row("ナビゲーション種別", nav.type, "navigate=通常遷移 / reload=再読込 / back_forward=戻る・進む / prerender=先読み"));
      rows.push(row("リダイレクト回数", nav.redirectCount));
    }
    return card("流入元・リファラ", {}, table(rows));
  }

  function sectionParams(params) {
    const tracking = params.filter((p) => isTrackingParam(p.name));
    const rows = params.map((p) =>
      row(`${p.name}${p.from === "hash" ? " (#)" : ""}`, safeDecode(p.value) || "(空)", paramDesc(p.name))
    );
    return card(
      "URLパラメータ",
      { badge: `${params.length} 件`, badgeClass: params.length ? "" : "warn", sub: tracking.length ? `うち広告・計測系 ${tracking.length} 件` : null },
      params.length
        ? table(rows)
        : empty("パラメータはありません。末尾に ?utm_source=test&gclid=abc&fbclid=xyz のように付けて試せます。")
    );
  }

  function sectionCookies(S, docCookies) {
    const clientRows = docCookies.map((c) => {
      const info = cookieInfo(c.name, c.value);
      const v = safeDecode(c.value);
      const td = h("span");
      td.append(h("code", { class: "val", title: "クリックでコピー" }, v || "(空)"));
      if (info) {
        td.append(h("span", { class: "desc" }, info.label));
        if (info.decoded) td.append(h("span", { class: "desc" }, info.decoded));
      }
      return row(c.name, td);
    });
    const serverCookies = (S && S.cookies) || [];
    const serverRows = serverCookies.map((c) => row(c.name, safeDecode(c.value) || "(空)"));

    const cNames = new Set(docCookies.map((c) => c.name));
    const sNames = new Set(serverCookies.map((c) => c.name));
    const serverOnly = [...sNames].filter((n) => !cNames.has(n));
    const clientOnly = [...cNames].filter((n) => !sNames.has(n));

    const left = h("div", null, h("h3", null, `ブラウザ側 document.cookie (${docCookies.length})`), docCookies.length ? table(clientRows) : empty("JavaScriptから読めるCookieはありません"));
    const right = h("div", null, h("h3", null, `サーバー側 Cookie ヘッダー (${serverCookies.length})`), serverCookies.length ? table(serverRows) : empty("ページ読み込み時に送られたCookieはありません"));

    const diff = [];
    if (serverOnly.length) diff.push(row("サーバーにのみ届いたCookie", serverOnly.join(", "), "HttpOnly属性のCookieは document.cookie から見えません"));
    if (clientOnly.length) diff.push(row("ブラウザにのみ存在するCookie", clientOnly.join(", "), "ページ読み込み後にJavaScript(計測タグ等)がセットしたものです"));

    return card(
      "Cookie",
      { badge: `${docCookies.length} 件`, sub: "既知の広告・計測Cookieは意味と値の中身を解読して表示します" },
      h("div", { class: "dual" }, left, right),
      diff.length ? table(diff) : null
    );
  }

  function sectionNetwork(S) {
    if (!S) return card("サーバー側で判定した接続情報 (Cloudflare)", { badge: "取得失敗", badgeClass: "warn" }, empty("サーバー側データを取得できませんでした(ローカルで静的ファイルのみ配信している場合など)。"));
    const n = S.network;
    const rows = [
      row("IPアドレス", n.ip, `${n.ipVersion || ""}`),
      row("国", n.country, n.isEUCountry ? "EU加盟国 (GDPR対象)" : null),
      row("地域", [n.region, n.regionCode && `(${n.regionCode})`].filter(Boolean).join(" ")),
      row("市区町村", n.city, "IPからの推定。実際の居場所と異なることがあります"),
      row("郵便番号", n.postalCode),
      row("緯度 / 経度", n.latitude != null ? `${n.latitude}, ${n.longitude}` : null),
      row("大陸", n.continent),
      row("タイムゾーン (IP推定)", n.timezone),
      row("ASN / 組織", n.asn != null ? `AS${n.asn} ${n.asOrganization || ""}` : null, "回線事業者・クラウド・VPN/プロキシ判別の手がかり"),
      row("Cloudflare データセンター", n.colo, "リクエストを処理した拠点 (IATAコード)"),
      row("HTTPバージョン", n.httpProtocol),
      row("TLS", [n.tlsVersion, n.tlsCipher].filter(Boolean).join(" / ")),
      row("TCP RTT (ms)", n.clientTcpRtt),
    ];
    if (S.bot) {
      rows.push(row("Bot スコア", S.bot.score, "1=bot濃厚 〜 99=人間濃厚"));
      rows.push(row("Verified Bot", tfmt(S.bot.verifiedBot)));
      rows.push(row("JA3 / JA4", [S.bot.ja3Hash, S.bot.ja4].filter(Boolean).join(" / ")));
    } else {
      rows.push(row("Bot判定", "利用不可", "Cloudflare Bot Management は有料プラン機能のため、このサイトでは取得できません"));
    }
    return card("サーバー側で判定した接続情報 (Cloudflare)", { sub: "request.cf / リクエストヘッダーより" }, table(rows));
  }

  function sectionCrosscheck(S, uaData) {
    if (!S) return null;
    const rows = [];
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const serverTz = S.network.timezone;
    if (clientTz && serverTz) {
      const ok = clientTz === serverTz;
      rows.push(row("タイムゾーン", ok ? "一致" : "不一致", `ブラウザ: ${clientTz} / IP推定: ${serverTz}${ok ? "" : " (VPN・プロキシ・海外からの接続の可能性)"}`));
    }
    const al = S.headers["accept-language"];
    if (al) {
      const top = al.split(",")[0].trim();
      const ok = top.toLowerCase().startsWith((navigator.language || "").split("-")[0].toLowerCase());
      rows.push(row("言語", ok ? "一致" : "不一致", `ブラウザ: ${navigator.language} / Accept-Language先頭: ${top}`));
    }
    const uaHeader = S.headers["user-agent"];
    if (uaHeader) {
      const ok = uaHeader === navigator.userAgent;
      rows.push(row("User-Agent", ok ? "一致" : "不一致", ok ? null : "HTTPヘッダーとnavigator.userAgentが異なります (UA偽装・拡張機能など)"));
    }
    const gpcHeader = S.headers["sec-gpc"];
    rows.push(row("Global Privacy Control", gpcHeader === "1" ? "送信あり" : "送信なし", `ブラウザ側 navigator.globalPrivacyControl: ${navigator.globalPrivacyControl === undefined ? "非対応" : navigator.globalPrivacyControl}`));
    return rows.length ? card("ブラウザ側とサーバー側の照合", { note: "計測結果がずれる原因(VPN、言語設定、拡張機能、プライバシー設定)の切り分けに使えます。" }, table(rows)) : null;
  }

  function sectionBrowser(uaData) {
    const tz = Intl.DateTimeFormat().resolvedOptions();
    const conn = navigator.connection || {};
    const rows = [
      row("User-Agent", navigator.userAgent),
      row("プラットフォーム", navigator.platform),
      row("ベンダー", navigator.vendor),
    ];
    if (uaData) {
      rows.push(
        row("UA Client Hints: ブランド", uaData.brands),
        row("UA Client Hints: OS", [uaData.platform, uaData.platformVersion].filter(Boolean).join(" ")),
        row("UA Client Hints: モバイル", tfmt(uaData.mobile)),
        row("UA Client Hints: アーキテクチャ", [uaData.architecture, uaData.bitness && `${uaData.bitness}bit`].filter(Boolean).join(" ")),
        row("UA Client Hints: モデル", uaData.model),
        row("UA Client Hints: 詳細バージョン", uaData.uaFullVersion)
      );
    } else {
      rows.push(row("UA Client Hints", "非対応", "Chromium系以外のブラウザでは取得できません"));
    }
    rows.push(
      row("言語 (navigator.language)", navigator.language),
      row("言語リスト", (navigator.languages || []).join(", ")),
      row("タイムゾーン", tz.timeZone),
      row("UTCとの差", `${-new Date().getTimezoneOffset() / 60 >= 0 ? "+" : ""}${-new Date().getTimezoneOffset() / 60} 時間`),
      row("画面サイズ", `${screen.width} × ${screen.height}`, `利用可能領域 ${screen.availWidth} × ${screen.availHeight}`),
      row("ビューポート", `${innerWidth} × ${innerHeight}`),
      row("デバイスピクセル比", window.devicePixelRatio),
      row("色深度", screen.colorDepth),
      row("画面の向き", screen.orientation && screen.orientation.type),
      row("タッチポイント数", navigator.maxTouchPoints),
      row("入力デバイス", `${mm("(pointer: coarse)") ? "タッチ中心" : "マウス中心"} / hover ${mm("(hover: hover)") ? "可" : "不可"}`),
      row("CPUコア数", navigator.hardwareConcurrency),
      row("メモリ目安 (GB)", navigator.deviceMemory, "Chromium系のみ・概算値"),
      row("ダークモード", tfmt(mm("(prefers-color-scheme: dark)"))),
      row("動きを減らす設定", tfmt(mm("(prefers-reduced-motion: reduce)"))),
      row("PWA/スタンドアロン表示", tfmt(mm("(display-mode: standalone)"))),
      row("接続種別", conn.effectiveType, conn.downlink != null ? `下り ${conn.downlink} Mbps / RTT ${conn.rtt} ms${conn.saveData ? " / データセーバーON" : ""}` : "Chromium系のみ"),
      row("オンライン", tfmt(navigator.onLine)),
      row("自動操作 (webdriver)", tfmt(navigator.webdriver), "true の場合はテスト自動化ツール等から操作されています"),
      row("PDFビューア内蔵", tfmt(navigator.pdfViewerEnabled))
    );
    return card("ブラウザ・デバイス", {}, table(rows));
  }

  function sectionPrivacy(docCookies) {
    const dnt = navigator.doNotTrack || window.doNotTrack || (navigator.msDoNotTrack ?? null);
    const ls = storageKeys(localStorage);
    const ss = storageKeys(sessionStorage);
    const rows = [
      row("Cookie 有効", tfmt(navigator.cookieEnabled)),
      row("Do Not Track", dnt == null ? "未設定/非対応" : dnt === "1" || dnt === "yes" ? "ON (追跡拒否)" : "OFF", String(dnt)),
      row("Global Privacy Control", navigator.globalPrivacyControl === undefined ? "非対応" : tfmt(navigator.globalPrivacyControl), "ON の場合、法域によっては『販売・共有のオプトアウト』として扱う必要があります"),
      row("localStorage キー", ls ? (ls.length ? ls.join(", ") : "なし") : "アクセス不可", ls ? `${ls.length} 件` : "ブラウザ設定でブロックされている可能性があります"),
      row("sessionStorage キー", ss ? (ss.length ? ss.join(", ") : "なし") : "アクセス不可", ss ? `${ss.length} 件` : null),
      row("サードパーティCookie", "判定なし", "このページ単体では判定できません (ブラウザ設定やITP/ETPの影響を受けます)"),
    ];
    return card("プライバシー・ストレージ", {}, table(rows));
  }

  function sectionPage() {
    const nav = getNav();
    const rows = [
      row("URL", location.href),
      row("ホスト", location.host),
      row("パス", location.pathname),
      row("ハッシュ (#)", location.hash || null, "ハッシュはサーバーに送信されません"),
      row("タイトル", document.title),
      row("文字コード", document.characterSet),
      row("表示状態", document.visibilityState, "prerender/hidden の場合、計測のPVが二重・欠落する原因になります"),
      row("読み込み時刻", fmtDate(Date.now())),
    ];
    if (nav) {
      rows.push(
        row("プロトコル", nav.protocol),
        row("TTFB (ms)", nav.ttfb),
        row("DOMContentLoaded (ms)", nav.dcl),
        row("load (ms)", nav.load)
      );
    }
    return card("ページ・読み込み情報", {}, table(rows));
  }

  const HEADER_DESC = {
    "user-agent": "ブラウザ・OSの識別文字列",
    "accept-language": "ブラウザの言語設定 (優先度付き)",
    referer: "遷移元URL (ブラウザ側のReferrer-Policyに従う)",
    cookie: "送信されたCookie全体",
    "sec-ch-ua": "UA Client Hints: ブランド",
    "sec-ch-ua-mobile": "UA Client Hints: モバイル",
    "sec-ch-ua-platform": "UA Client Hints: OS",
    "sec-fetch-site": "遷移元との関係 (none=直接, same-origin, same-site, cross-site)",
    "sec-fetch-mode": "リクエストモード (navigate=ページ遷移)",
    "sec-fetch-dest": "リクエスト先の種別 (document=ページ)",
    "sec-fetch-user": "ユーザー操作による遷移か (?1)",
    "sec-gpc": "Global Privacy Control (1=ON)",
    dnt: "Do Not Track (1=ON)",
    "cf-connecting-ip": "Cloudflareが判定した接続元IP",
    "cf-ipcountry": "Cloudflareが判定した国コード",
    "cf-ray": "Cloudflareのリクエスト識別子 (問い合わせ時に使用)",
    "cf-visitor": "訪問者の接続スキーム",
    "x-forwarded-for": "経由したIPの連なり",
    "x-forwarded-proto": "接続スキーム",
    "upgrade-insecure-requests": "HTTPS化を希望",
    "save-data": "データセーバー設定",
    "purpose": "先読み(prefetch/prerender)リクエストの目印",
  };
  function sectionHeaders(S) {
    if (!S) return null;
    const entries = Object.entries(S.headers).sort(([a], [b]) => a.localeCompare(b));
    return card(
      "HTTPリクエストヘッダー (サーバー受信)",
      { badge: `${entries.length} 件` },
      table(entries.map(([k, v]) => row(k, k === "cookie" ? "(上の「Cookie」セクションで表示)" : v, HEADER_DESC[k])))
    );
  }

  // ---------- 描画 ----------
  async function main() {
    const app = document.getElementById("app");
    const S = readServer();
    const params = parseParams();
    const docCookies = parseDocCookie();
    const referrer = document.referrer;
    const qp = Object.fromEntries(params.map((p) => [p.name, p.value]));
    const channel = guessChannel(referrer || (S && S.headers && S.headers.referer) || "", qp);
    const uaData = await getUAData();

    const parts = [
      sectionSummary(S, params, referrer, docCookies, channel),
      sectionReferrer(S, referrer, channel),
      sectionParams(params),
      sectionCookies(S, docCookies),
      sectionNetwork(S),
      sectionCrosscheck(S, uaData),
      sectionBrowser(uaData),
      sectionPrivacy(docCookies),
      sectionPage(),
      sectionHeaders(S),
    ].filter(Boolean);

    app.replaceChildren(...parts);
    bindInteractions();
  }

  // ---------- インタラクション ----------
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function bindInteractions() {
    document.getElementById("app").addEventListener("click", async (e) => {
      const el = e.target.closest(".val");
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.textContent);
        toast("コピーしました");
      } catch { /* クリップボード不可は無視 */ }
    });

    const input = document.getElementById("filter");
    const apply = () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll("#app section.card").forEach((sec) => {
        const trs = sec.querySelectorAll("tr");
        let visible = 0;
        trs.forEach((tr) => {
          const hit = !q || tr.textContent.toLowerCase().includes(q);
          tr.classList.toggle("hidden", !hit);
          if (hit) visible++;
        });
        sec.classList.toggle("hidden", !!q && trs.length > 0 && visible === 0);
        sec.style.display = sec.classList.contains("hidden") ? "none" : "";
      });
    };
    input.addEventListener("input", apply);
  }

  document.getElementById("reload").addEventListener("click", () => location.reload());
  // 要約カードの.summaryは.cardではないため絞り込み対象外(常時表示)
  main().catch((err) => {
    document.getElementById("app").replaceChildren(h("p", { class: "loading" }, `表示に失敗しました: ${err && err.message}`));
  });
})();
