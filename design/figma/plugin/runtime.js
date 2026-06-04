/*
 * Kachō Design System Importer — runtime.
 * Ожидает глобальный объект DATA (инлайнится генератором build.mjs в code.js).
 * Создаёт: Variables (Dark/Light) + Radius, Text styles, Effect styles,
 * страницу Foundations (свотчи/типографика/компоненты) и страницу Screens
 * (растровые референсы). Всё идемпотентно-терпимо: ошибки секций не валят запуск.
 */

// ---------- утилиты цвета ----------
function clamp01(n) { return Math.max(0, Math.min(1, n)); }

function parseColor(str) {
  if (!str) return { r: 0, g: 0, b: 0, a: 1 };
  str = String(str).trim();
  if (str[0] === "#") {
    var hex = str.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.slice(0, 2), 16) / 255;
    var g = parseInt(hex.slice(2, 4), 16) / 255;
    var b = parseInt(hex.slice(4, 6), 16) / 255;
    return { r: r, g: g, b: b, a: 1 };
  }
  var m = str.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    var p = m[1].split(",").map(function (x) { return parseFloat(x.trim()); });
    return { r: clamp01(p[0] / 255), g: clamp01(p[1] / 255), b: clamp01(p[2] / 255), a: p[3] === undefined ? 1 : clamp01(p[3]) };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function solid(c) { return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }; }

// ---------- base64 → Uint8Array ----------
function b64ToBytes(b64) {
  if (typeof figma !== "undefined" && figma.base64Decode) {
    try { return figma.base64Decode(b64); } catch (e) {}
  }
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var lookup = {};
  for (var i = 0; i < chars.length; i++) lookup[chars[i]] = i;
  b64 = b64.replace(/=+$/, "");
  var bytes = [];
  var buf = 0, bits = 0;
  for (var j = 0; j < b64.length; j++) {
    var v = lookup[b64[j]];
    if (v === undefined) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  return new Uint8Array(bytes);
}

// ---------- шрифты с фолбэком ----------
var FAMILY = "Inter";
var STYLE_CACHE = {};
async function pickFamily() {
  var candidates = ["Inter", "Roboto", "Helvetica Neue", "Arial"];
  for (var i = 0; i < candidates.length; i++) {
    try { await figma.loadFontAsync({ family: candidates[i], style: "Regular" }); FAMILY = candidates[i]; return; }
    catch (e) {}
  }
  FAMILY = "Roboto";
  try { await figma.loadFontAsync({ family: FAMILY, style: "Regular" }); } catch (e) {}
}
async function styleFor(weight) {
  var pref = weight >= 600 ? ["Semi Bold", "SemiBold", "Bold", "Medium", "Regular"]
    : weight >= 500 ? ["Medium", "Semi Bold", "Regular"]
    : ["Regular"];
  for (var i = 0; i < pref.length; i++) {
    var key = FAMILY + "::" + pref[i];
    if (STYLE_CACHE[key]) return pref[i];
    try { await figma.loadFontAsync({ family: FAMILY, style: pref[i] }); STYLE_CACHE[key] = true; return pref[i]; }
    catch (e) {}
  }
  return "Regular";
}

// ---------- текст-нода ----------
async function txt(s, weight, size, color) {
  var t = figma.createText();
  t.fontName = { family: FAMILY, style: await styleFor(weight || 400) };
  t.characters = String(s);
  if (size) t.fontSize = size;
  if (color) t.fills = [solid(color)];
  return t;
}

// ---------- Variables ----------
function makeVar(name, collection, type) {
  try { return figma.variables.createVariable(name, collection, type); }
  catch (e) { return figma.variables.createVariable(name, collection.id, type); }
}

function buildColorVariables() {
  var col = figma.variables.createVariableCollection("Kachō Colors");
  var darkMode = col.modes[0].modeId;
  try { col.renameMode(darkMode, "Dark"); } catch (e) {}
  var lightMode;
  try { lightMode = col.addMode("Light"); } catch (e) { lightMode = darkMode; }
  var map = {};
  DATA.colors.forEach(function (c) {
    var v = makeVar(c.path, col, "COLOR");
    v.setValueForMode(darkMode, parseColor(c.dark));
    v.setValueForMode(lightMode, parseColor(c.light));
    map[c.path] = v;
  });
  DATA.brand.forEach(function (c) {
    var v = makeVar("brand/" + c.path, col, "COLOR");
    v.setValueForMode(darkMode, parseColor(c.value));
    v.setValueForMode(lightMode, parseColor(c.value));
    map["brand/" + c.path] = v;
  });
  return map;
}

function buildRadiusVariables() {
  if (!DATA.radius.length) return;
  var col = figma.variables.createVariableCollection("Kachō Radius");
  var mode = col.modes[0].modeId;
  DATA.radius.forEach(function (r) {
    var v = makeVar("radius/" + r.path, col, "FLOAT");
    v.setValueForMode(mode, Number(r.value));
  });
}

// ---------- Text styles ----------
async function buildTextStyles() {
  for (var i = 0; i < DATA.textStyles.length; i++) {
    var d = DATA.textStyles[i];
    try {
      var st = figma.createTextStyle();
      st.name = "Kachō/" + d.name;
      st.fontName = { family: FAMILY, style: await styleFor(d.weight) };
      st.fontSize = Number(d.size);
      if (d.lineHeight) st.lineHeight = { unit: "PERCENT", value: Math.round(Number(d.lineHeight) * 100) };
      if (d.letterSpacing) st.letterSpacing = { unit: "PERCENT", value: parseFloat(d.letterSpacing) };
    } catch (e) {}
  }
}

// ---------- Effect styles ----------
function buildEffectStyles() {
  DATA.shadows.forEach(function (s) {
    try {
      var es = figma.createEffectStyle();
      es.name = "Kachō/Shadow " + s.name;
      var c = parseColor(s.color);
      es.effects = [{
        type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
        color: { r: c.r, g: c.g, b: c.b, a: c.a },
        offset: { x: Number(s.x), y: Number(s.y) },
        radius: Number(s.blur), spread: Number(s.spread)
      }];
    } catch (e) {}
  });
}

// ---------- Foundations page ----------
function col(path) {
  var f = DATA.colors.filter(function (c) { return c.path === path; })[0];
  return parseColor(f ? f.dark : "#000000");
}
function brand(path) {
  var f = DATA.brand.filter(function (c) { return c.path === path; })[0];
  return parseColor(f ? f.value : "#3d8df5");
}

function autoFrame(name, dir) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir || "VERTICAL";
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  f.itemSpacing = 12;
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = 0;
  f.fills = [];
  return f;
}

async function swatch(path, value) {
  var box = autoFrame("swatch:" + path, "VERTICAL");
  box.itemSpacing = 6;
  var rect = figma.createFrame();
  rect.resize(96, 48);
  rect.cornerRadius = 8;
  rect.fills = [solid(value)];
  rect.strokes = [solid({ r: 1, g: 1, b: 1, a: 0.08 })];
  rect.strokeWeight = 1;
  box.appendChild(rect);
  var label = await txt(path, 500, 11, col("text/secondary"));
  box.appendChild(label);
  return box;
}

async function pill(label, bg, fg, bd) {
  var p = autoFrame("badge", "HORIZONTAL");
  p.paddingTop = p.paddingBottom = 3; p.paddingLeft = p.paddingRight = 10;
  p.cornerRadius = 999; p.itemSpacing = 0;
  p.fills = [solid(bg)];
  p.strokes = [solid(bd)]; p.strokeWeight = 1;
  p.appendChild(await txt(label, 500, 12, fg));
  return p;
}

async function button(label, bg, fg) {
  var b = autoFrame("button", "HORIZONTAL");
  b.paddingTop = b.paddingBottom = 9; b.paddingLeft = b.paddingRight = 16;
  b.cornerRadius = 8; b.fills = [solid(bg)];
  b.appendChild(await txt(label, 600, 13, fg));
  return b;
}

async function buildFoundations() {
  var page = figma.createPage();
  page.name = "Kachō — Foundations";
  figma.currentPage = page;
  page.backgrounds = [solid(col("bg/page"))];

  var root = autoFrame("Foundations", "VERTICAL");
  root.itemSpacing = 28;
  root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = 40;
  root.fills = [solid(col("bg/page"))];
  root.counterAxisSizingMode = "AUTO";

  root.appendChild(await txt("Kachō Console — Foundations", 600, 20, col("text/primary")));

  // Colors
  root.appendChild(await txt("Colors (dark mode)", 600, 15, col("text/primary")));
  var grid = autoFrame("colors", "HORIZONTAL");
  grid.layoutWrap = "WRAP"; grid.itemSpacing = 12; grid.counterAxisSpacing = 12;
  grid.resize(900, 10); grid.counterAxisSizingMode = "FIXED"; grid.primaryAxisSizingMode = "FIXED";
  var keys = ["bg/page", "bg/container", "bg/elevated", "text/primary", "text/secondary",
    "text/tertiary", "border/default", "color/primary", "color/destructive",
    "status/okFg", "status/warnFg", "status/infoFg", "status/violetFg"];
  for (var i = 0; i < keys.length; i++) grid.appendChild(await swatch(keys[i], col(keys[i])));
  root.appendChild(grid);

  // Type specimen
  root.appendChild(await txt("Typography", 600, 15, col("text/primary")));
  var spec = autoFrame("type", "VERTICAL"); spec.itemSpacing = 10;
  for (var t = 0; t < DATA.textStyles.length; t++) {
    var d = DATA.textStyles[t];
    spec.appendChild(await txt(d.name + " — Создание сервисного аккаунта", d.weight, Number(d.size), col("text/primary")));
  }
  root.appendChild(spec);

  // Status badges
  root.appendChild(await txt("Status badges", 600, 15, col("text/primary")));
  var badges = autoFrame("badges", "HORIZONTAL"); badges.itemSpacing = 10;
  var bdefs = [["RUNNING", "status/okBg", "status/okFg", "status/okBorder"],
    ["PENDING", "status/warnBg", "status/warnFg", "status/warnBorder"],
    ["INFO", "status/infoBg", "status/infoFg", "status/infoBorder"],
    ["ERROR", "status/errorBg", "status/errorFg", "status/errorBorder"],
    ["SYSTEM", "status/violetBg", "status/violetFg", "status/violetBorder"]];
  for (var k = 0; k < bdefs.length; k++) {
    var bd = bdefs[k];
    badges.appendChild(await pill(bd[0], col(bd[1]), col(bd[2]), col(bd[3])));
  }
  root.appendChild(badges);

  // Buttons
  root.appendChild(await txt("Buttons", 600, 15, col("text/primary")));
  var btns = autoFrame("buttons", "HORIZONTAL"); btns.itemSpacing = 12;
  btns.appendChild(await button("Создать", brand("primary"), { r: 1, g: 1, b: 1, a: 1 }));
  btns.appendChild(await button("Отмена", col("color/secondary"), col("text/primary")));
  root.appendChild(btns);

  // Card
  root.appendChild(await txt("Card / surface", 600, 15, col("text/primary")));
  var card = autoFrame("card", "VERTICAL");
  card.itemSpacing = 8; card.cornerRadius = 12;
  card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 16;
  card.fills = [solid(col("bg/container"))];
  card.strokes = [solid(col("border/secondary"))]; card.strokeWeight = 1;
  card.appendChild(await txt("service-account-01", 600, 14, col("text/primary")));
  card.appendChild(await txt("ID: sa-7f3a · создан 2 дня назад", 400, 13, col("text/secondary")));
  root.appendChild(card);

  page.appendChild(root);
}

// ---------- Screens page ----------
function buildScreens() {
  if (!DATA.images || !DATA.images.length) return;
  var page = figma.createPage();
  page.name = "Kachō — Screens (reference)";
  figma.currentPage = page;
  var x = 0;
  DATA.images.forEach(function (img) {
    try {
      var image = figma.createImage(b64ToBytes(img.base64));
      var w = 720, h = Math.round(720 * (img.h / img.w));
      var f = figma.createFrame();
      f.name = img.name;
      f.resize(w, h);
      f.x = x; f.y = 0;
      f.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
      x += w + 48;
    } catch (e) {}
  });
}

// ---------- main ----------
(async function () {
  try { if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync(); } catch (e) {}
  await pickFamily();
  var report = [];
  try { buildColorVariables(); report.push("Variables (Dark/Light)"); } catch (e) { report.push("colors FAILED: " + e); }
  try { buildRadiusVariables(); report.push("Radius vars"); } catch (e) {}
  try { await buildTextStyles(); report.push("Text styles"); } catch (e) { report.push("text styles FAILED: " + e); }
  try { buildEffectStyles(); report.push("Effect styles"); } catch (e) {}
  try { await buildFoundations(); report.push("Foundations page"); } catch (e) { report.push("foundations FAILED: " + e); }
  try { buildScreens(); report.push("Screens page"); } catch (e) {}
  figma.notify("Kachō: " + report.join(" · "), { timeout: 6000 });
  figma.closePlugin("Готово: " + report.join(", "));
})();
