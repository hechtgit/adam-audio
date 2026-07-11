/* ADAM-PLAYER v6 — audio prehrávač pre blog články hechtberger.com
 * Hosted na GitHub Pages (hechtgit.github.io/adam-audio); footer na webe ho už len načíta.
 * Manifest + marks + MP3 žijú v tom istom repe — nový článok = git push, žiadny zásah do webu.
 * Fail-soft: ak manifest/článok/telo chýba, NIČ neurobí (web sa nikdy nerozbije).
 *
 * v6 = v5 (funkčne zhodné: end-card, JSON-LD, seek, highlight) s novým dizajnom:
 *  - hranaté rohy (celý web je hranatý) — žiadny border-radius
 *  - znak: tmavý outline rámik kocky + trojuholník + zlatý skener (seal ako na mape)
 *  - wordmark „ADAM" pod znakom (medzera = výška čiary, ťah písma = hrúbka rámika, merané canvasom)
 *  - svetlosivé play/pauza tlačidlo (predtým zanikalo)
 *  - decentná zlatá neurónová sieť v tmavej časti POČAS prehrávania (RAF beží len keď hrá)
 *  - voliteľná rýchlosť prehrávania, zapamätaná v prehliadači
 */
(function () {
  "use strict";
  var BASE = "https://hechtgit.github.io/adam-audio/";
  var GOLD = "#b18542";
  var INK = "#1a1206";      // tmavá: rámik kocky + trojuholník + wordmark
  var SCAN = "#b18542";     // zlatý skener v jadre — rovnaká zlatá ako podklad/znak (jednotná)
  var CTA_URL = "/strategia-privatnej-renty?src=adam-audio";
  var CTA_LABEL = "Zistiť moju privátnu rentu";
  var CTA_LEAD = "Viete, akú mesačnú rentu môžete čerpať zo svojho majetku?";
  var RATE_KEY = "adam-audio-rate";
  var RATE_OPTIONS = [1, 1.25, 1.5, 1.75, 2];

  function slug() {
    var m = location.pathname.match(/\/blog\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function explicitMount() {
    return document.querySelector("[data-adam-audio-slug]");
  }

  function rentIntroAnchor() {
    var nodes = [].slice.call(document.querySelectorAll(
      "main h1, main h2, main h3, main h4, main p, .sqs-html-content h1, .sqs-html-content h2, .sqs-html-content h3, .sqs-html-content h4, .sqs-html-content p"
    ));
    for (var i = 0; i < nodes.length; i++) {
      if (normTxt(nodes[i].textContent || "").toLowerCase() !== "prečo privátna renta") continue;
      var scope = nodes[i].closest(".sqs-html-content") || nodes[i].parentNode;
      if (!scope) return nodes[i];
      var sectionNodes = [].slice.call(scope.querySelectorAll("h1, h2, h3, h4, p"));
      var start = sectionNodes.indexOf(nodes[i]);
      if (start < 0) return nodes[i];
      var paragraphs = [];
      for (var j = start + 1; j < sectionNodes.length; j++) {
        var el = sectionNodes[j];
        var tag = (el.tagName || "").toLowerCase();
        if (/^h[1-4]$/.test(tag) && paragraphs.length) break;
        if (tag === "p" && normTxt(el.textContent || "")) {
          paragraphs.push(el);
          if (paragraphs.length === 2) return el;
        }
      }
      return paragraphs.length ? paragraphs[paragraphs.length - 1] : nodes[i];
    }
    return null;
  }

  function retryRentIntroPlacement(pageMount, tries) {
    if (!pageMount) return;
    var anchor = rentIntroAnchor();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(pageMount, anchor.nextSibling);
    }
    if (tries > 0) {
      setTimeout(function () { retryRentIntroPlacement(pageMount, tries - 1); }, 250);
    }
  }

  function pageAudioTarget() {
    var mount = explicitMount();
    if (mount) {
      var forced = mount.getAttribute("data-adam-audio-slug");
      if (forced) return { slug: forced, mount: mount, wrapText: false };
    }
    if (location.pathname.replace(/\/+$/, "") === "/strategia-privatnej-renty") {
      var calc = document.getElementById("ph-renta-calculator");
      var anchor = rentIntroAnchor();
      if ((anchor && anchor.parentNode) || (calc && calc.parentNode)) {
        var pageMount = document.getElementById("adam-audio-mount");
        if (!pageMount) {
          pageMount = document.createElement("div");
          pageMount.id = "adam-audio-mount";
        }
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(pageMount, anchor.nextSibling);
        else calc.parentNode.insertBefore(pageMount, calc);
        retryRentIntroPlacement(pageMount, 20);
        return { slug: "strategia-privatnej-renty", mount: pageMount, wrapText: false, introSuffix: "vám stručne predstaví aplikáciu." };
      }
    }
    var s = slug();
    return s ? { slug: s, mount: null, wrapText: true } : null;
  }

  function findBlocks() {
    return [].slice.call(document.querySelectorAll(
      ".BlogItem .sqs-html-content, article .sqs-html-content, .blog-item-wrapper .sqs-html-content, main .sqs-html-content, .sqs-html-content"
    )).filter(function (b) {
      return !b.closest("footer, .Footer, #footer, header, .Header") && b.querySelectorAll("p").length > 0;
    });
  }

  function esc(s){ var d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
  function fmt(s){ s=Math.max(0,Math.floor(s||0)); var m=Math.floor(s/60), r=s%60; return m+":"+(r<10?"0":"")+r; }
  function fmtRate(rate) { return (rate === 1 ? "1" : String(rate)) + "x"; }
  function closestRate(v) {
    v = parseFloat(v);
    if (!isFinite(v)) return 1;
    var best = RATE_OPTIONS[0], bd = Math.abs(v - best);
    for (var i = 1; i < RATE_OPTIONS.length; i++) {
      var d = Math.abs(v - RATE_OPTIONS[i]);
      if (d < bd) { best = RATE_OPTIONS[i]; bd = d; }
    }
    return best;
  }
  function savedRate() {
    try { return closestRate(localStorage.getItem(RATE_KEY)); }
    catch (e) { return 1; }
  }
  function persistRate(rate) {
    try { localStorage.setItem(RATE_KEY, String(rate)); }
    catch (e) { /* fail-soft */ }
  }

  // Normalizuj text na porovnanie: zlúč medzery a odstráň medzeru pred interpunkciou
  // (marks môžu mať artefakt "slovo ." — na stránke je "slovo.").
  function normTxt(s){ return s.replace(/\s+([.,;:!?…])/g, "$1").replace(/\s+/g, " ").trim(); }

  function wrapSentences(blocks, marks) {
    var ps = [];
    blocks.forEach(function (b) { [].slice.call(b.querySelectorAll("p")).forEach(function (p) { ps.push(p); }); });
    var norms = ps.map(function (p) { return normTxt(p.textContent); });
    var gi = 0, wrapped = 0;
    for (var pi = 0; pi < ps.length && gi < marks.length; pi++) {
      var txt = norms[pi];
      if (!txt) continue;
      var html = "", pos = 0, matchedHere = false;
      while (gi < marks.length) {
        var target = normTxt(marks[gi].text);
        if (!target) { gi++; continue; }
        var idx = txt.indexOf(target, pos);
        if (idx < 0) {
          // Ak značka nie je v žiadnom NASLEDUJÚCOM odseku, je to text mimo <p>
          // (popisok/graf) — preskoč ju, nezasekni zvyšok článku.
          var later = false;
          for (var k = pi + 1; k < ps.length; k++) { if (norms[k].indexOf(target) >= 0) { later = true; break; } }
          if (!later) { gi++; continue; }
          break;
        }
        if (idx > pos) html += esc(txt.slice(pos, idx));
        html += '<span class="adam-s" data-i="' + marks[gi].i + '">' + esc(target) + "</span>";
        pos = idx + target.length; gi++; matchedHere = true; wrapped++;
      }
      if (matchedHere) { html += esc(txt.slice(pos)); ps[pi].innerHTML = html; }
    }
    return wrapped;
  }

  // JSON-LD: AudioObject (audio verzia článku) + speakable — len na stránkach s audiom.
  function injectSchema(data) {
    try {
      if (document.getElementById("adam-ldjson")) return;
      var d = Math.round(data.duration || 0);
      var iso = "PT" + Math.floor(d / 60) + "M" + (d % 60) + "S";
      var url = location.origin + location.pathname;
      var ld = [{
        "@context": "https://schema.org",
        "@type": "AudioObject",
        "name": (data.title || document.title) + " — audio verzia",
        "description": "Článok prečítaný nahlas Adamom, AI asistentom Petra Hechtbergera. Slovenský syntetický hlas, s prepisom priamo na stránke.",
        "contentUrl": data.mp3,
        "encodingFormat": "audio/mpeg",
        "inLanguage": "sk",
        "duration": iso,
        "isAccessibleForFree": true,
        "author": { "@type": "Person", "name": "Petr Hechtberger", "url": "https://www.hechtberger.com/" }
      }, {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "url": url,
        "speakable": { "@type": "SpeakableSpecification", "cssSelector": [".sqs-html-content p"] }
      }];
      var sc = document.createElement("script");
      sc.type = "application/ld+json"; sc.id = "adam-ldjson";
      sc.text = JSON.stringify(ld);
      document.head.appendChild(sc);
    } catch (e) { /* fail-soft */ }
  }

  function ensurePlayerStyles() {
    if (document.getElementById("adam-player-dynamic-style")) return;
    var st = document.createElement("style");
    st.id = "adam-player-dynamic-style";
    st.textContent =
      "#adam-player #adam-btn{background-color:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";}" +
      "#adam-player #adam-btn[data-idle-pulse='1'].adam-css-pulse{animation:adamButtonColorPulse 5s infinite;}" +
      "#adam-player #adam-btn[data-idle-pulse='0']{animation:none;background-color:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";}" +
      "#adam-player #adam-rate-wrap{position:relative;display:inline-flex;align-items:center;width:70px;min-width:70px;margin-left:auto;}" +
      "#adam-player #adam-rate{width:70px;height:30px;min-width:70px;border-radius:0;border:1px solid rgba(177,133,66,.72);background:rgba(177,133,66,.14);color:#e6e1d8;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;padding:0 5px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;}" +
      "#adam-player #adam-rate,#adam-player #adam-rate-menu,#adam-player #adam-rate-menu button{box-sizing:border-box;}" +
      "#adam-player #adam-rate:focus{outline:1px solid " + GOLD + ";outline-offset:1px;}" +
      "#adam-player #adam-rate svg{display:block;flex:0 0 auto;}" +
      "#adam-player #adam-rate .adam-rate-gauge{width:12px;height:12px;color:" + GOLD + ";}" +
      "#adam-player #adam-rate .adam-rate-caret{width:10px;height:10px;color:" + GOLD + ";}" +
      "#adam-player #adam-rate-menu{display:none;position:absolute;right:0;top:calc(100% + 7px);z-index:5;width:70px;border:1px solid rgba(177,133,66,.42);background:#171513;box-shadow:0 14px 26px rgba(0,0,0,.28);padding:4px;gap:2px;}" +
      "#adam-player #adam-rate-wrap[data-open='1'] #adam-rate-menu{display:grid;}" +
      "#adam-player #adam-rate-menu button{height:28px;border:0;border-radius:0;background:transparent;color:#8a8578;text-align:left;padding:0 7px;font-size:12px;font-variant-numeric:tabular-nums;cursor:pointer;}" +
      "#adam-player #adam-rate-menu button[aria-checked='true']{background:" + GOLD + ";color:" + INK + ";font-weight:500;}" +
      "@keyframes adamButtonColorPulse{" +
        "0%{background-color:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";animation-timing-function:cubic-bezier(.4,0,.2,1);}" +
        "50%{background-color:#1f1f1f;border-color:#1f1f1f;color:" + GOLD + ";animation-timing-function:cubic-bezier(.4,0,.2,1);}" +
        "100%{background-color:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";}" +
      "}" +
      "@media (prefers-reduced-motion:reduce){#adam-player #adam-btn[data-idle-pulse='1']{animation:none!important;}}";
    document.head.appendChild(st);
  }

  // Kanonický lockup: seal + ADAM, deterministicky v jednom SVG (bez runtime merania textu).
  var MK = '<rect width="60" height="72" fill="' + GOLD + '"/>' +
    '<rect x="8" y="8" width="44" height="44" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' +
    '<path d="M30 8.8 L51.2 51.2 L8.8 51.2 Z" fill="' + INK + '"/>' +
    '<defs><clipPath id="adamC"><path d="M30 8.8 L51.2 51.2 L8.8 51.2 Z"/></clipPath></defs>' +
    '<g clip-path="url(#adamC)"><rect x="4" y="48.6" width="52" height="2.6" fill="' + SCAN + '">' +
    '<animate id="adam-scan-anim" attributeName="y" values="48.6;8.8;48.6" dur="5s" keyTimes="0;0.5;1" calcMode="spline" ' +
    'keySplines="0.4 0 0.2 1;0.4 0 0.2 1" begin="indefinite" repeatCount="indefinite"/></rect></g>' +
    '<text x="30.4" y="63" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="600" textLength="46.4" lengthAdjust="spacing" fill="' + INK + '">ADAM</text>';

  function build(data, target) {
    target = target || {};
    var blocks = target.wrapText === false ? [] : findBlocks();
    if (!blocks.length && !target.mount) return;
    if (document.getElementById("adam-player")) return;
    ensurePlayerStyles();

    var introSuffix = target.introSuffix || "vám článok prečíta.";
    var wrap = document.createElement("div");
    wrap.id = "adam-player";
    wrap.setAttribute("style",
      "border:.5px solid #3a3733;border-radius:0;background:#1f1f1f;overflow:visible;" +
      "margin:0 0 24px;font-family:system-ui,-apple-system,sans-serif;");
    wrap.innerHTML =
      '<div id="adam-row" style="display:flex;align-items:stretch">' +
        '<div id="adam-mkw" style="flex:0 0 auto;align-self:stretch;background:' + GOLD + ';width:150px;' +
          'display:flex;justify-content:center;align-items:center;padding:16px 0">' +
          '<svg id="adam-mk" viewBox="0 0 60 72" width="94" height="113" style="display:block">' + MK + '</svg>' +
        '</div>' +
        '<div id="adam-right" style="flex:1;min-width:0;position:relative;overflow:visible">' +
          '<canvas id="adam-nn" style="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0"></canvas>' +
          '<div id="adam-main" style="position:relative;z-index:1;padding:18px 20px">' +
            '<div style="display:flex;align-items:center;gap:16px">' +
              '<div style="flex:1;min-width:0">' +
                '<p style="margin:0 0 6px;font-size:18px;line-height:1.3;color:#f0ede8">Nechce sa vám čítať?<br>' +
                  '<b style="color:' + GOLD + ';font-weight:500">Adam</b> ' + introSuffix + '</p>' +
                '<p style="margin:0;font-size:13px;color:#8a8578">AI asistent Petra Hechtbergera</p>' +
              '</div>' +
              '<button id="adam-btn" data-idle-pulse="1" aria-label="Prehrať článok" style="width:70px;height:70px;min-width:70px;' +
                'border-radius:0;border-width:1px;border-style:solid;cursor:pointer;display:flex;' +
                'align-items:center;justify-content:center;padding:0">' +
                '<svg id="adam-ic" viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
              '</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap">' +
              '<span id="adam-cur" style="font-size:12px;color:#8a8578;font-variant-numeric:tabular-nums;min-width:30px">0:00</span>' +
              '<div id="adam-track" style="flex:1;min-width:120px;height:4px;background:#33302c;border-radius:0;position:relative;cursor:pointer;touch-action:none">' +
                '<div id="adam-bar" style="height:4px;width:0;background:' + GOLD + ';border-radius:0"></div>' +
                '<div id="adam-thumb" style="position:absolute;top:50%;left:0;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:0;background:' + GOLD + ';opacity:0"></div>' +
              '</div>' +
              '<span id="adam-dur" style="font-size:12px;color:#8a8578;font-variant-numeric:tabular-nums;min-width:30px;text-align:right">0:00</span>' +
              '<div id="adam-rate-wrap" data-open="0">' +
                '<button id="adam-rate" type="button" aria-label="Rýchlosť prehrávania 1x" aria-haspopup="menu" aria-expanded="false" title="Rýchlosť prehrávania">' +
                  '<svg class="adam-rate-gauge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<path d="M5 19a8 8 0 1 1 14 0"/><path d="M12 15l4-4"/><path d="M12 15h.01"/>' +
                  '</svg>' +
                  '<span id="adam-rate-label">1x</span>' +
                  '<svg class="adam-rate-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>' +
                '</button>' +
                '<div id="adam-rate-menu" role="menu" aria-label="Rýchlosť prehrávania">' +
                  '<button type="button" role="menuitemradio" data-rate="1" aria-checked="true">1x</button>' +
                  '<button type="button" role="menuitemradio" data-rate="1.25" aria-checked="false">1.25x</button>' +
                  '<button type="button" role="menuitemradio" data-rate="1.5" aria-checked="false">1.5x</button>' +
                  '<button type="button" role="menuitemradio" data-rate="1.75" aria-checked="false">1.75x</button>' +
                  '<button type="button" role="menuitemradio" data-rate="2" aria-checked="false">2x</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="adam-end" style="display:none;position:relative;z-index:1;padding:18px 20px">' +
            '<p style="margin:0 0 14px;font-size:17px;line-height:1.35;color:#f0ede8">' + CTA_LEAD + '</p>' +
            '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
              '<a id="adam-cta" href="' + CTA_URL + '" style="display:inline-block;background:' + GOLD + ';color:#1a1a1a;' +
                'font-size:15px;font-weight:600;padding:11px 20px;border-radius:0;text-decoration:none">' + CTA_LABEL + '</a>' +
              '<a id="adam-again" href="#" style="font-size:13px;color:#8a8578;text-decoration:underline">Prehrať znova</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<audio id="adam-au" preload="metadata" src="' + data.mp3 + '"></audio>';
    if (target.mount) target.mount.appendChild(wrap);
    else blocks[0].parentNode.insertBefore(wrap, blocks[0]);

    var right = wrap.querySelector("#adam-right");

    // Decentná zlatá neurónová sieť: statická hneď po načítaní, hýbe sa až počas prehrávania.
    var nn = (function(){
      var cv = wrap.querySelector("#adam-nn"); if (!cv || !cv.getContext) return { idle:function(){}, start:function(){}, stop:function(){} };
      var ctx = cv.getContext("2d"), raf = null, nodes = [], W = 0, H = 0,
          dpr = Math.min(window.devicePixelRatio || 1, 2), MAX = 110, SPEED = 0.30, t0 = 0;
      function rnd(a, b){ return a + Math.random() * (b - a); }
      function init(forceNodes){
        var r = right.getBoundingClientRect(); W = r.width; H = r.height;
        if (!W || !H) return false;
        cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!forceNodes && nodes.length) return true;
        var N = 60;
        nodes = []; for (var i = 0; i < N; i++) nodes.push({ x:rnd(6,W-6), y:rnd(6,H-6), ang:rnd(0,6.283), ph:rnd(0,6.283) });
        return true;
      }
      function draw(ts, move){
        if (!t0) t0 = ts;
        ctx.clearRect(0, 0, W, H);
        var i, a, b;
        for (i = 0; i < nodes.length; i++){
          var n = nodes[i];
          if (move) {
            n.ang += rnd(-0.02, 0.02);
            n.x += Math.cos(n.ang) * SPEED; n.y += Math.sin(n.ang) * SPEED;
            if (n.x < 0){ n.x = 0; n.ang = Math.PI - n.ang; } else if (n.x > W){ n.x = W; n.ang = Math.PI - n.ang; }
            if (n.y < 0){ n.y = 0; n.ang = -n.ang; } else if (n.y > H){ n.y = H; n.ang = -n.ang; }
          }
        }
        for (a = 0; a < nodes.length; a++) for (b = a + 1; b < nodes.length; b++){
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, d = Math.sqrt(dx*dx + dy*dy);
          if (d < MAX){ ctx.strokeStyle = "rgba(216,176,106," + ((1 - d/MAX) * 0.24).toFixed(3) + ")"; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke(); }
        }
        var tt = (ts - t0) * 0.001;
        for (i = 0; i < nodes.length; i++){ var m = nodes[i], pu = move ? 0.60 + 0.26 * Math.sin(tt * 1.256 + m.ph) : 0.62;
          ctx.fillStyle = "rgba(222,184,116," + pu.toFixed(3) + ")"; ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, 6.283); ctx.fill();
        }
      }
      function frame(ts){
        draw(ts, true);
        raf = requestAnimationFrame(frame);
      }
      return {
        idle: function(){ try { if (!init(false)) return; t0 = 0; draw(0, false); } catch(e){} },
        start: function(){ try { if (raf) return; if (!init(false)) return; t0 = 0; raf = requestAnimationFrame(frame); } catch(e){} },
        stop: function(){ try { if (raf){ cancelAnimationFrame(raf); raf = null; } if (W && H) draw(0, false); } catch(e){} }
      };
    })();
    nn.idle();

    if (blocks.length) wrapSentences(blocks, data.marks || []);
    var SP = "transition:background .4s,color .4s;border-radius:0;padding:0 2px;";
    var SPON = SP + "background:rgba(177,133,66,.28);color:#fff;";
    var spanByI = {};
    blocks.forEach(function (body) {
      [].slice.call(body.querySelectorAll(".adam-s")).forEach(function(s){ s.style.cssText = SP; spanByI[s.getAttribute("data-i")] = s; });
    });

    var marks = data.marks || [];
    var au = wrap.querySelector("#adam-au"), btn = wrap.querySelector("#adam-btn"), ic = wrap.querySelector("#adam-ic"),
        bar = wrap.querySelector("#adam-bar"), thumb = wrap.querySelector("#adam-thumb"), track = wrap.querySelector("#adam-track"),
        curT = wrap.querySelector("#adam-cur"), durT = wrap.querySelector("#adam-dur"), hlEl = null,
        main = wrap.querySelector("#adam-main"), endc = wrap.querySelector("#adam-end"),
        again = wrap.querySelector("#adam-again"), rateWrap = wrap.querySelector("#adam-rate-wrap"),
        rateBtn = wrap.querySelector("#adam-rate"), rateLabel = wrap.querySelector("#adam-rate-label"),
        rateMenu = wrap.querySelector("#adam-rate-menu"), rateButtons = rateMenu ? [].slice.call(rateMenu.querySelectorAll("[data-rate]")) : [],
        btnPulse = null;
    var PLAY = '<path d="M8 5v14l11-7z"/>', PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
    var DUR = data.duration || 0;
    if (DUR) durT.textContent = fmt(DUR);
    au.addEventListener("loadedmetadata", function(){ if (isFinite(au.duration) && au.duration) { DUR = au.duration; durT.textContent = fmt(DUR); } });

    function setRate(rate, persist) {
      rate = closestRate(rate);
      try {
        au.playbackRate = rate;
        au.defaultPlaybackRate = rate;
        au.preservesPitch = true;
        au.webkitPreservesPitch = true;
        au.mozPreservesPitch = true;
      } catch (e) { /* fail-soft */ }
      if (rateLabel) rateLabel.textContent = fmtRate(rate);
      if (rateBtn) rateBtn.setAttribute("aria-label", "Rýchlosť prehrávania " + fmtRate(rate));
      rateButtons.forEach(function(opt){
        opt.setAttribute("aria-checked", closestRate(opt.getAttribute("data-rate")) === rate ? "true" : "false");
      });
      if (persist) persistRate(rate);
    }
    function setRateOpen(open) {
      if (!rateWrap || !rateBtn) return;
      rateWrap.setAttribute("data-open", open ? "1" : "0");
      rateBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    setRate(savedRate(), false);
    if (rateBtn) rateBtn.addEventListener("click", function(e){
      e.stopPropagation();
      setRateOpen(rateWrap && rateWrap.getAttribute("data-open") !== "1");
    });
    if (rateMenu) rateMenu.addEventListener("click", function(e){
      var opt = e.target && e.target.closest ? e.target.closest("[data-rate]") : null;
      if (!opt) return;
      e.stopPropagation();
      setRate(opt.getAttribute("data-rate"), true);
      setRateOpen(false);
    });
    document.addEventListener("click", function(e){ if (rateWrap && !rateWrap.contains(e.target)) setRateOpen(false); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape") setRateOpen(false); });

    function hi(el){ if(el===hlEl)return; if(hlEl)hlEl.style.cssText=SP; if(el)el.style.cssText=SPON; hlEl=el; }
    function paint(t){
      var f = DUR ? Math.min(1, t/DUR) : 0;
      bar.style.width = (f*100) + "%"; thumb.style.left = (f*100) + "%";
      curT.textContent = fmt(t);
    }
    au.addEventListener("timeupdate", function(){
      var t = au.currentTime; paint(t);
      var el = null;
      for (var j=0;j<marks.length;j++){ if (t>=marks[j].start && t<marks[j].end){ el = spanByI[marks[j].i] || null; break; } }
      hi(el);
    });

    function startIdlePulse(){
      try {
        var scan = wrap.querySelector("#adam-scan-anim");
        if (scan && scan.beginElement) scan.beginElement();
      } catch (e) { /* fail-soft */ }
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (btn.animate) {
        btnPulse = btn.animate([
          { backgroundColor: GOLD, borderColor: GOLD, color: INK, offset: 0, easing: "cubic-bezier(.4,0,.2,1)" },
          { backgroundColor: "#1f1f1f", borderColor: "#1f1f1f", color: GOLD, offset: 0.5, easing: "cubic-bezier(.4,0,.2,1)" },
          { backgroundColor: GOLD, borderColor: GOLD, color: INK, offset: 1 }
        ], { duration: 5000, iterations: Infinity });
      } else {
        btn.classList.add("adam-css-pulse");
      }
    }

    function lockBtn(){
      btn.setAttribute("data-idle-pulse", "0");
      if (btnPulse) { btnPulse.cancel(); btnPulse = null; }
      btn.classList.remove("adam-css-pulse");
      btn.style.animation = "none";
      btn.style.background = GOLD;
      btn.style.borderColor = GOLD;
      btn.style.color = INK;
    }
    startIdlePulse();

    // Sieť naviazaná priamo na audio stav (spoľahlivejšie než klik na tlačidlo).
    au.addEventListener("play", function(){ lockBtn(); nn.start(); });
    au.addEventListener("pause", function(){ nn.stop(); });

    // End-card po dohraní: stabilná výška (žiadny skok layoutu), CTA + replay.
    au.addEventListener("ended", function(){
      nn.stop();
      ic.innerHTML = PLAY; thumb.style.opacity = "0"; hi(null); paint(0);
      right.style.minHeight = right.getBoundingClientRect().height + "px";
      main.style.display = "none"; endc.style.display = "block";
    });
    again.addEventListener("click", function(e){
      e.preventDefault();
      endc.style.display = "none"; main.style.display = "block";
      au.currentTime = 0; au.play();
      ic.innerHTML = PAUSE; thumb.style.opacity = "1";
    });

    btn.addEventListener("click", function(){
      if (au.paused){ au.play(); ic.innerHTML=PAUSE; thumb.style.opacity="1"; }
      else { au.pause(); ic.innerHTML=PLAY; }
    });

    // Seek: klik + drag + touch (pointer events).
    function seekTo(clientX){
      var r = track.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      if (DUR){ au.currentTime = f * DUR; paint(au.currentTime); }
    }
    var dragging = false;
    track.addEventListener("pointerdown", function(e){ dragging = true; thumb.style.opacity="1"; try{track.setPointerCapture(e.pointerId);}catch(_){ } seekTo(e.clientX); });
    track.addEventListener("pointermove", function(e){ if (dragging) seekTo(e.clientX); });
    track.addEventListener("pointerup", function(){ dragging = false; if (au.paused) thumb.style.opacity="0"; });
    track.addEventListener("pointercancel", function(){ dragging = false; });
  }

  function init(){
    var target = pageAudioTarget(); if(!target || !target.slug) return;
    fetch(BASE + "manifest.json", {cache: "no-cache"})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(man){
        var e = man && man[target.slug]; if(!e || !e.mp3) return;
        return fetch(BASE + e.marks, {cache: "no-cache"})
          .then(function(r){ return r.ok ? r.json() : {sentences: []}; })
          .then(function(mk){
            var data = { mp3: BASE + e.mp3, title: e.title, duration: e.duration,
                         marks: (mk && mk.sentences) || [] };
            injectSchema(data);
            try { build(data, target); } catch(err) { /* fail-soft */ }
          });
      })
      .catch(function(){ /* fail-soft */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
