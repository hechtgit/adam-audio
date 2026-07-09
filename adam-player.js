/* ADAM-PLAYER v5 — audio prehrávač pre blog články hechtberger.com
 * Hosted na GitHub Pages (hechtgit.github.io/adam-audio); footer na webe ho už len načíta.
 * Manifest + marks + MP3 žijú v tom istom repe — nový článok = git push, žiadny zásah do webu.
 * Fail-soft: ak manifest/článok/telo chýba, NIČ neurobí (web sa nikdy nerozbije).
 *
 * v5 = v4 (dizajn NEMENIŤ — odsúhlasený) s remote manifestom:
 *  - end-card po dohraní: zlaté CTA → /strategia-privatnej-renty + „Prehrať znova"
 *  - JSON-LD AudioObject + WebPage.speakable pre články s audiom (AI/SEO signál)
 */
(function () {
  "use strict";
  var BASE = "https://hechtgit.github.io/adam-audio/";
  var GOLD = "#b18542";
  var CTA_URL = "/strategia-privatnej-renty?src=adam-audio";
  var CTA_LABEL = "Zistiť moju privátnu rentu";
  var CTA_LEAD = "Viete, akú mesačnú rentu môžete čerpať zo svojho majetku?";

  function slug() {
    var m = location.pathname.match(/\/blog\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
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

  function wrapSentences(blocks, marks) {
    var gi = 0, wrapped = 0;
    blocks.forEach(function (body) {
      [].slice.call(body.querySelectorAll("p")).forEach(function (p) {
        if (gi >= marks.length) return;
        var txt = p.textContent.replace(/\s+/g, " ").trim();
        if (!txt) return;
        var html = "", pos = 0, matchedHere = false;
        while (gi < marks.length) {
          var target = marks[gi].text.replace(/\s+/g, " ").trim();
          var idx = txt.indexOf(target, pos);
          if (idx < 0) break;
          if (idx > pos) html += esc(txt.slice(pos, idx));
          html += '<span class="adam-s" data-i="' + marks[gi].i + '">' + esc(target) + "</span>";
          pos = idx + target.length; gi++; matchedHere = true; wrapped++;
        }
        if (matchedHere) { html += esc(txt.slice(pos)); p.innerHTML = html; }
      });
    });
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

  // Znak vždy s pulzom (idle animácia = kanonická značka Adama).
  var MK = '<rect x="8" y="8" width="44" height="44" fill="' + GOLD + '"/><path d="M30 8 L52 52 L8 52 Z" fill="#2b2b2b"/>' +
    '<defs><clipPath id="adamC"><path d="M30 8 L52 52 L8 52 Z"/></clipPath></defs>' +
    '<g clip-path="url(#adamC)"><rect x="4" y="50" width="52" height="2.6" fill="' + GOLD + '">' +
    '<animate attributeName="y" values="50;7;50" dur="5s" keyTimes="0;0.5;1" calcMode="spline" ' +
    'keySplines="0.4 0 0.2 1;0.4 0 0.2 1" repeatCount="indefinite"/></rect></g>';

  function build(data) {
    var blocks = findBlocks();
    if (!blocks.length) return;
    if (document.getElementById("adam-player")) return;

    var wrap = document.createElement("div");
    wrap.id = "adam-player";
    wrap.setAttribute("style",
      "border:.5px solid #3a3733;border-radius:12px;background:#1f1f1f;overflow:hidden;" +
      "margin:0 0 24px;font-family:system-ui,-apple-system,sans-serif;");
    wrap.innerHTML =
      '<div id="adam-row" style="display:flex;align-items:stretch">' +
        '<div id="adam-mkw" style="flex:0 0 auto;align-self:stretch;background:' + GOLD + ';width:120px;line-height:0">' +
          '<svg id="adam-mk" viewBox="0 0 60 60" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">' + MK + '</svg>' +
        '</div>' +
        '<div id="adam-right" style="flex:1;min-width:0;padding:18px 20px">' +
          '<div id="adam-main">' +
            '<div style="display:flex;align-items:center;gap:16px">' +
              '<div style="flex:1;min-width:0">' +
                '<p style="margin:0 0 6px;font-size:18px;line-height:1.3;color:#f0ede8">Nechce sa vám čítať?<br>' +
                  '<b style="color:' + GOLD + ';font-weight:500">Adam</b> vám článok prečíta.</p>' +
                '<p style="margin:0;font-size:13px;color:#8a8578">AI asistent Petra Hechtbergera</p>' +
              '</div>' +
              '<button id="adam-btn" aria-label="Prehrať článok" style="width:54px;height:54px;min-width:54px;' +
                'border-radius:50%;border:1px solid #57534c;background:transparent;cursor:pointer;display:flex;' +
                'align-items:center;justify-content:center;padding:0;color:#f0ede8">' +
                '<svg id="adam-ic" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
              '</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:16px">' +
              '<span id="adam-cur" style="font-size:12px;color:#8a8578;font-variant-numeric:tabular-nums;min-width:30px">0:00</span>' +
              '<div id="adam-track" style="flex:1;height:4px;background:#33302c;border-radius:2px;position:relative;cursor:pointer;touch-action:none">' +
                '<div id="adam-bar" style="height:4px;width:0;background:' + GOLD + ';border-radius:2px"></div>' +
                '<div id="adam-thumb" style="position:absolute;top:50%;left:0;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:' + GOLD + ';opacity:0"></div>' +
              '</div>' +
              '<span id="adam-dur" style="font-size:12px;color:#8a8578;font-variant-numeric:tabular-nums;min-width:30px;text-align:right">0:00</span>' +
            '</div>' +
          '</div>' +
          '<div id="adam-end" style="display:none">' +
            '<p style="margin:0 0 14px;font-size:17px;line-height:1.35;color:#f0ede8">' + CTA_LEAD + '</p>' +
            '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
              '<a id="adam-cta" href="' + CTA_URL + '" style="display:inline-block;background:' + GOLD + ';color:#1a1a1a;' +
                'font-size:15px;font-weight:600;padding:11px 20px;border-radius:8px;text-decoration:none">' + CTA_LABEL + '</a>' +
              '<a id="adam-again" href="#" style="font-size:13px;color:#8a8578;text-decoration:underline">Prehrať znova</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<audio id="adam-au" preload="metadata" src="' + data.mp3 + '"></audio>';
    blocks[0].parentNode.insertBefore(wrap, blocks[0]);

    var mkw = wrap.querySelector("#adam-mkw"), right = wrap.querySelector("#adam-right");
    // Znak flush (align-self:stretch) => výška = výška boxu. Dorovnaj ŠÍRKU na
    // štvorec = výška znaku (meraj vlastný wrapper => žiadna slučka cez reflow).
    function fitMark(){
      var h = Math.round(mkw.getBoundingClientRect().height);
      var w = Math.round(mkw.getBoundingClientRect().width);
      if (h > 20 && Math.abs(w - h) > 1) { mkw.style.width = h + "px"; }
    }
    requestAnimationFrame(fitMark);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMark);
    window.addEventListener("load", fitMark);
    if (window.ResizeObserver) { new ResizeObserver(fitMark).observe(right); }
    var rsT; window.addEventListener("resize", function(){ clearTimeout(rsT); rsT = setTimeout(fitMark, 150); });

    wrapSentences(blocks, data.marks || []);
    var SP = "transition:background .4s,color .4s;border-radius:3px;padding:0 2px;";
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
        again = wrap.querySelector("#adam-again");
    var PLAY = '<path d="M8 5v14l11-7z"/>', PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
    var DUR = data.duration || 0;
    if (DUR) durT.textContent = fmt(DUR);
    au.addEventListener("loadedmetadata", function(){ if (isFinite(au.duration) && au.duration) { DUR = au.duration; durT.textContent = fmt(DUR); } });

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

    // End-card po dohraní: stabilná výška (žiadny skok layoutu), CTA + replay.
    au.addEventListener("ended", function(){
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
    var s = slug(); if(!s) return;
    fetch(BASE + "manifest.json", {cache: "no-cache"})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(man){
        var e = man && man[s]; if(!e || !e.mp3) return;
        return fetch(BASE + e.marks, {cache: "no-cache"})
          .then(function(r){ return r.ok ? r.json() : {sentences: []}; })
          .then(function(mk){
            var data = { mp3: BASE + e.mp3, title: e.title, duration: e.duration,
                         marks: (mk && mk.sentences) || [] };
            injectSchema(data);
            try { build(data); } catch(err) { /* fail-soft */ }
          });
      })
      .catch(function(){ /* fail-soft */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
