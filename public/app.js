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
  let secCount = 0;
  const card = (title, opts, ...body) => {
    const n = String(++secCount).padStart(2, "0");
    return h(
      "section",
      { class: `card panel${opts.wide ? " wide" : ""}`, id: `sec-${n}`, "data-title": title },
      h("span", { class: "tick tr", "aria-hidden": "true" }),
      h("span", { class: "tick bl", "aria-hidden": "true" }),
      h(
        "h2",
        null,
        h("span", { class: "code" }, `SEC-${n}`),
        h("span", { class: "ttl" }, title),
        h("span", { class: "rule", "aria-hidden": "true" }),
        opts.badge && h("span", { class: `badge ${opts.badgeClass || ""}` }, opts.badge)
      ),
      opts.sub && h("p", { class: "sub" }, opts.sub),
      opts.note && h("p", { class: "note" }, opts.note),
      body
    );
  };
  const chip = (text, kind) => h("span", { class: `chip ${kind || ""}` }, text);
  const NS = "http://www.w3.org/2000/svg";
  const sv = (tag, attrs, ...kids) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    for (const c of kids.flat()) if (c) n.append(c);
    return n;
  };
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

  // 世界地図(粗い簡易ポリゴン: [経度, 緯度])。ドットパターンで塗るため輪郭は概略で足りる
  const LAND = [
    [[-168,66],[-156,71],[-125,70],[-95,72],[-80,63],[-65,60],[-55,50],[-70,42],[-76,35],[-81,25],[-97,26],[-97,18],[-87,21],[-83,10],[-78,8],[-86,13],[-105,20],[-118,32],[-124,40],[-124,48],[-135,58],[-150,60]],
    [[-78,8],[-62,10],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-45],[-70,-55],[-74,-50],[-72,-30],[-80,-6]],
    [[-55,60],[-20,70],[-20,82],[-60,82],[-72,76]],
    [[-10,36],[-9,43],[0,50],[10,55],[25,70],[60,70],[100,78],[140,72],[170,68],[160,55],[142,46],[130,35],[122,28],[108,20],[100,8],[104,1],[98,16],[90,22],[80,10],[73,20],[58,25],[48,30],[35,32],[28,36],[22,38],[12,44],[3,43]],
    [[-17,21],[-10,35],[10,37],[32,31],[43,12],[51,11],[40,-15],[33,-27],[20,-35],[13,-22],[9,4],[-8,5],[-17,14]],
    [[114,-22],[130,-12],[142,-11],[153,-26],[148,-38],[135,-35],[115,-34]],
    [[129.5,33],[132,34.5],[136,35],[140,35.5],[141.5,38],[142,41.5],[141.5,45],[145,43.5],[141,41],[140.8,39],[140,36],[136.5,34],[135,33.5],[132,33],[130.5,31]],
  ];

  function radar(n) {
    const W = 360, H = 180;
    const X = (lon) => lon + 180, Y = (lat) => 90 - lat;
    const lat = parseFloat(n && n.latitude), lon = parseFloat(n && n.longitude);
    const has = Number.isFinite(lat) && Number.isFinite(lon);
    const g = [];
    for (let x = 0; x <= W; x += 30) g.push(sv("line", { class: "grat", x1: x, y1: 0, x2: x, y2: H }));
    for (let y = 0; y <= H; y += 30) g.push(sv("line", { class: `grat${y === 90 ? " equator" : ""}`, x1: 0, y1: y, x2: W, y2: y }));
    const land = LAND.map((poly) => sv("polygon", { class: "land", points: poly.map(([a, b]) => `${X(a)},${Y(b)}`).join(" ") }));
    const mk = [];
    if (has) {
      const cx = X(lon), cy = Y(lat);
      mk.push(
        sv("line", { class: "xhair", x1: cx, y1: 0, x2: cx, y2: H }),
        sv("line", { class: "xhair", x1: 0, y1: cy, x2: W, y2: cy }),
        sv("circle", { class: "pulse", cx, cy, r: 3 }),
        sv("circle", { class: "pulse p2", cx, cy, r: 3 }),
        sv("circle", { class: "core", cx, cy, r: 1.8 }),
        sv("path", { class: "lock", d: `M${cx - 7},${cy - 4}v-3h3 M${cx + 4},${cy - 7}h3v3 M${cx + 7},${cy + 4}v3h-3 M${cx - 4},${cy + 7}h-3v-3` })
      );
    }
    return sv(
      "svg",
      { class: "radar", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": has ? `推定位置 緯度${lat} 経度${lon}` : "位置情報なし" },
      sv(
        "defs", null,
        sv("pattern", { id: "dots", width: 3, height: 3, patternUnits: "userSpaceOnUse" }, sv("circle", { cx: 1.5, cy: 1.5, r: 0.75, fill: "currentColor" })),
        sv("linearGradient", { id: "sweepg", x1: 0, x2: 1, y1: 0, y2: 0 },
          sv("stop", { offset: "0", "stop-color": "#22e5ff", "stop-opacity": "0" }),
          sv("stop", { offset: "1", "stop-color": "#22e5ff", "stop-opacity": ".28" }))
      ),
      g, land,
      sv("rect", { class: "sweep", x: 0, y: 0, width: 50, height: H, fill: "url(#sweepg)" }),
      mk
    );
  }

  function ring(pct) {
    const R = 32, C = 2 * Math.PI * R;
    const arc = sv("circle", { class: "arc", cx: 45, cy: 45, r: R, transform: "rotate(-90 45 45)" });
    arc.style.setProperty("--da", `${(C * pct).toFixed(1)} ${C.toFixed(1)}`);
    const ticks = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * 2 * Math.PI, r1 = 40, r2 = i % 3 === 0 ? 43.5 : 42;
      ticks.push(sv("line", { x1: 45 + r1 * Math.cos(a), y1: 45 + r1 * Math.sin(a), x2: 45 + r2 * Math.cos(a), y2: 45 + r2 * Math.sin(a) }));
    }
    return sv("svg", { class: "ring", viewBox: "0 0 90 90", role: "img", "aria-label": `${Math.round(pct * 100)}%` },
      sv("g", { class: "ticks" }, ticks),
      sv("circle", { class: "track", cx: 45, cy: 45, r: R }), arc,
      sv("text", { x: 45, y: 46 }, `${Math.round(pct * 100)}%`));
  }

  function sectionSummary(S, params, referrer, docCookies, channel) {
    const n = S && S.network;
    const ga = docCookies.find((c) => c.name === "_ga");
    const gaId = ga && /^GA\d\.\d+\.(\d+\.\d+)$/.exec(ga.value);
    const tracking = params.filter((p) => isTrackingParam(p.name)).length;
    const known = docCookies.filter((c) => cookieInfo(c.name, c.value)).length;
    const stat = (k, jp, v, cls) =>
      h("div", { class: `stat ${cls || ""}` },
        h("div", { class: "k" }, k, h("small", null, jp)),
        h("div", Object.assign({ class: `v${isEmpty(v) ? " none" : ""}` }, isEmpty(v) ? {} : { "data-decode": "1" }), isEmpty(v) ? "取得できず" : v));
    const f = (k, v) => h("div", null, h("div", { class: "k" }, k), h("div", { class: "v" }, isEmpty(v) ? "—" : String(v)));
    const loc = n && [n.country, n.region, n.city].filter(Boolean).join(" / ");
    const pct = docCookies.length ? known / docCookies.length : 0;

    return h(
      "div",
      { class: "hero panel", id: "sec-00", "data-title": "概要 / 位置" },
      h("span", { class: "tick tr", "aria-hidden": "true" }),
      h("span", { class: "tick bl", "aria-hidden": "true" }),
      h("div", { class: "radar-card" },
        h("div", { class: "hud-label" }, "GEO-LOCATE // IPからの推定位置"),
        radar(n),
        h("div", { class: "readout" },
          f("LAT", n && n.latitude), f("LON", n && n.longitude),
          f("TZ", n && n.timezone), f("ASN", n && n.asn != null ? `AS${n.asn}` : null))),
      h("div", { class: "stats" },
        stat("IP", "IPアドレス", n && n.ip, "span2"),
        stat("LOCATION", "推定所在地", loc, "span2"),
        stat("CHANNEL", "流入元(推定)", channel),
        stat("PARAMS", "広告・UTM", `${tracking} 件`),
        stat("REFERRER", "リファラ", referrer || "なし", "span2"),
        stat("GA CLIENT", "GA Client ID", gaId ? gaId[1] : null, "span2"),
        h("div", { class: "stat ringtile span2" }, ring(pct),
          h("div", null, h("div", { class: "k" }, "COOKIE DECODE", h("small", null, "判別済み計測系Cookie")),
            h("div", { class: "v" }, `${known} / ${docCookies.length} 件`))))
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
    rows.push(row("クライアントとサーバーの一致", chip(same ? "一致" : "不一致", same ? "ok" : "warn"), same ? null : "ブラウザ拡張やリダイレクトで差が出ることがあります"));
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
      { wide: true, badge: `${docCookies.length} 件`, sub: "既知の広告・計測Cookieは意味と値の中身を解読して表示します" },
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
      rows.push(row("タイムゾーン", chip(ok ? "一致" : "不一致", ok ? "ok" : "warn"), `ブラウザ: ${clientTz} / IP推定: ${serverTz}${ok ? "" : " (VPN・プロキシ・海外からの接続の可能性)"}`));
    }
    const al = S.headers["accept-language"];
    if (al) {
      const top = al.split(",")[0].trim();
      const ok = top.toLowerCase().startsWith((navigator.language || "").split("-")[0].toLowerCase());
      rows.push(row("言語", chip(ok ? "一致" : "不一致", ok ? "ok" : "warn"), `ブラウザ: ${navigator.language} / Accept-Language先頭: ${top}`));
    }
    const uaHeader = S.headers["user-agent"];
    if (uaHeader) {
      const ok = uaHeader === navigator.userAgent;
      rows.push(row("User-Agent", chip(ok ? "一致" : "不一致", ok ? "ok" : "warn"), ok ? null : "HTTPヘッダーとnavigator.userAgentが異なります (UA偽装・拡張機能など)"));
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
    return card("ページ・読み込み情報", { wide: true }, table(rows));
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
      { wide: true, badge: `${entries.length} 件` },
      table(entries.map(([k, v]) => row(k, k === "cookie" ? "(上の「Cookie」セクションで表示)" : v, HEADER_DESC[k])))
    );
  }

  // ---------- 演出 ----------
  const reduceMotion = mm("(prefers-reduced-motion: reduce)");
  const GLYPHS = "01ABCDEF<>/\\|#%$";

  // 値が文字化けから確定していくデコード演出
  function decode(el, ms = 750) {
    const final = el.textContent;
    if (!final || reduceMotion) return;
    const len = final.length, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms), fixed = Math.floor(p * len);
      let out = "";
      for (let i = 0; i < len; i++) {
        const c = final[i];
        out += i < fixed || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = p < 1 ? out : final;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // 起動シーケンス (クリック/キーでスキップ可)
  function startBoot(S) {
    if (reduceMotion) return Promise.resolve();
    const n = (S && S.network) || {};
    const lines = [
      "WHOAMI//MARKETING  CORE v1.0",
      `LINK ......... ESTABLISHED  [NODE ${n.colo || "--"}]`,
      `REQUEST ...... CAPTURED  [${n.httpProtocol || "--"} / ${n.tlsVersion || "--"}]`,
      "COOKIES ...... DECODING",
      "CLIENT ....... PROBING",
      "ALL SYSTEMS NOMINAL",
    ];
    const log = h("pre");
    const el = h("div", { id: "boot", "aria-hidden": "true" }, log, h("div", { class: "skip" }, "CLICK TO SKIP"));
    document.body.append(el);
    return new Promise((resolve) => {
      let i = 0, done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.classList.add("out");
        setTimeout(() => { el.remove(); resolve(); }, 350);
      };
      el.addEventListener("click", finish);
      window.addEventListener("keydown", finish, { once: true });
      const step = () => {
        if (done) return;
        if (i >= lines.length) { setTimeout(finish, 280); return; }
        log.textContent += lines[i++] + "\n";
        setTimeout(step, 170);
      };
      step();
    });
  }

  function fillStatus(S) {
    const n = (S && S.network) || {};
    const set = (id, v) => { const e = document.getElementById(id); if (e && v) e.textContent = v; };
    set("st-node", n.colo);
    set("st-ip", n.ip);
  }
  function tickClock() {
    const d = new Date(), p = (x) => String(x).padStart(2, "0");
    const a = document.getElementById("clk-utc"), b = document.getElementById("clk-loc");
    if (a) a.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
    if (b) b.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // 左サイドのセクションナビ + スクロール連動
  function buildRail(app) {
    const rail = document.getElementById("rail");
    const items = [...app.querySelectorAll("[data-title]")];
    const btns = new Map();
    rail.replaceChildren(
      h("div", { class: "rail-h" }, "SECTORS"),
      ...items.map((it) => {
        const b = h("button", { type: "button" }, h("span", { class: "c" }, it.id.replace("sec-", "")), it.dataset.title);
        b.addEventListener("click", () => it.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
        btns.set(it.id, b);
        return b;
      })
    );
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          btns.forEach((b) => b.classList.remove("on"));
          const b = btns.get(e.target.id);
          if (b) b.classList.add("on");
        }
      }
    }, { rootMargin: "-15% 0px -70% 0px" });
    items.forEach((it) => io.observe(it));
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
    buildRail(app);
    bindInteractions();
  }

  function reveal() {
    document.querySelectorAll("#app .card, #app .hero").forEach((el, i) => el.style.setProperty("--i", i));
    document.documentElement.classList.add("ready");
    document.querySelectorAll("#app [data-decode]").forEach((el) => decode(el));
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
        toast("COPIED");
      } catch { /* クリップボード不可は無視 */ }
    });

    const input = document.getElementById("filter");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll("#app section.card").forEach((sec) => {
        const trs = sec.querySelectorAll("tr");
        let visible = 0;
        trs.forEach((tr) => {
          const hit = !q || tr.textContent.toLowerCase().includes(q);
          tr.classList.toggle("hidden", !hit);
          if (hit) visible++;
        });
        sec.style.display = q && trs.length > 0 && visible === 0 ? "none" : "";
      });
    });
  }

  document.getElementById("reload").addEventListener("click", () => location.reload());

  // ---------- 起動 ----------
  const S0 = readServer();
  if (!reduceMotion) document.documentElement.classList.add("js-anim");
  fillStatus(S0);
  tickClock();
  setInterval(tickClock, 1000);
  const rendered = main().catch((err) => {
    document.getElementById("app").replaceChildren(h("p", { class: "loading" }, `表示に失敗しました: ${err && err.message}`));
  });
  Promise.all([rendered, startBoot(S0)]).then(reveal, reveal);
})();
