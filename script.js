"use strict";
const $ = (id) => document.getElementById(id);
const presets = {
  dust: {
    exposure: 0.25,
    contrast: 1.15,
    black: 0.07,
    gamma: 1.15,
    blur: 1.1,
    size: 1,
    density: 0.94,
    irregular: 0.38,
    dissolve: 0.1,
    fiber: 0,
  },
  erosion: {
    exposure: 0.3,
    contrast: 1.5,
    black: 0.15,
    gamma: 1.05,
    blur: 1.7,
    size: 2.1,
    density: 0.85,
    irregular: 0.85,
    dissolve: 0.25,
    fiber: 0.05,
  },
  organic: {
    exposure: 0.1,
    contrast: 1.25,
    black: 0.09,
    gamma: 1.1,
    blur: 0.6,
    size: 1.15,
    density: 0.9,
    irregular: 0.65,
    dissolve: 0.13,
    fiber: 0.8,
  },
};
const notes = {
  dust: "Grão fino.",
  erosion: "Partículas maiores.",
  organic: "Pequenos filamentos.",
};
let params = { ...presets.dust },
  currentPreset = "dust",
  seed = 146642,
  showOriginal = false,
  source = null,
  sourceName = "torus.generated",
  demo = "torus",
  frame = 0,
  cachedLuma = null,
  cachedBlur = null,
  stored = [];
const definitions = [
  ["exposure", "Exposição", -2, 2, 0.05, "tonal"],
  ["contrast", "Contraste", 0.5, 2.5, 0.05, "tonal"],
  ["black", "Pretos", 0, 0.6, 0.01, "tonal"],
  ["gamma", "Meios-tons", 0.4, 2.4, 0.05, "tonal"],
  ["blur", "Suavização", 0, 5, 0.1, "tonal"],
  ["size", "Tamanho do grão", 0.6, 4, 0.1, "grain"],
  ["density", "Densidade", 0.2, 1.5, 0.01, "grain"],
  ["irregular", "Irregularidade", 0, 1, 0.01, "grain"],
  ["dissolve", "Dissolução", 0, 0.8, 0.01, "grain"],
  ["fiber", "Filamentos", 0, 1, 0.01, "grain"],
];
for (const [key, label, min, max, step, group] of definitions) {
  const el = document.createElement("label");
  el.className = "control";
  el.innerHTML = `<span class="control-line"><span>${label}</span><output id="out-${key}" for="${key}"></output></span><input id="${key}" type="range" min="${min}" max="${max}" step="${step}">`;
  $(group + "Controls").append(el);
  $(key).addEventListener("input", () => {
    params[key] = +$(key).value;
    syncOutputs();
    schedule();
  });
}

function syncOutputs() {
  for (const [k] of definitions) {
    $(k).value = params[k];
    $("out-" + k).value = params[k].toFixed(2);
  }
}

function setPreset(key) {
  currentPreset = key;
  params = { ...presets[key] };
  syncOutputs();
  document.querySelectorAll("[data-preset]").forEach((b) => {
    b.classList.toggle("active", b.dataset.preset === key);
    b.setAttribute("aria-pressed", b.dataset.preset === key);
  });
  $("mobilePreset").value = key;
  $("presetNote").textContent = notes[key];
  $("renderState").textContent = key.toUpperCase() + " / STOCHASTIC GRAIN";
  schedule();
}

function hash(x, y, s) {
  let h = Math.imul(x ^ s, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeDemo(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d"),
    im = ctx.createImageData(1024, 1024);
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      let u = (x - 512) / 340,
        v = (y - 512) / 340;
      let qx = u * 0.95 + v * 0.22,
        qy = v * 1.1 - u * 0.08,
        r = Math.hypot(qx, qy),
        value = 0;
      if (kind === "torus") {
        let z2 = 0.32 * 0.32 - (r - 0.67) ** 2;
        if (z2 > 0) {
          let nz = Math.sqrt(z2) / 0.32,
            nr = (r - 0.67) / 0.32,
            nx = (nr * qx) / (r || 1),
            ny = (nr * qy) / (r || 1);
          value =
            Math.max(0, nx * -0.3 + ny * -0.61 + nz * 0.72) * 0.95 + 0.015;
        }
      } else if (r < 0.86) {
        let nz = Math.sqrt(1 - (r / 0.86) ** 2);
        value =
          Math.max(0, (-qx / 0.86) * 0.4 - (qy / 0.86) * 0.55 + nz * 0.7) *
            0.95 +
          0.01;
      }
      const i = (y * 1024 + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.min(255, value * 255);
      im.data[i + 3] = 255;
    }
  ctx.putImageData(im, 0, 0);
  return c;
}
function loadDemo(kind) {
  demo = kind;
  source = makeDemo(kind);
  sourceName = kind + ".generated";
  cachedLuma = null;
  updateSource();
  $("torus").classList.toggle("active", kind === "torus");
  $("sphere").classList.toggle("active", kind === "sphere");
  schedule();
}
function updateSource() {
  const w = source.naturalWidth || source.width,
    h = source.naturalHeight || source.height;
  $("fileInfo").textContent =
    sourceName + " · " + w + " × " + h + (demo ? " / demonstração" : "");
}
function dimensions(longSide) {
  const w = source.naturalWidth || source.width,
    h = source.naturalHeight || source.height;
  return w >= h
    ? [longSide, Math.max(1, Math.round((longSide * h) / w))]
    : [Math.max(1, Math.round((longSide * w) / h)), longSide];
}
function lumaFor(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${(params.blur * w) / 900}px)`;
  ctx.drawImage(source, 0, 0, w, h);
  const pix = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < lum.length; i++) {
    const p = i * 4;
    lum[i] =
      (pix[p] * 0.2126 + pix[p + 1] * 0.7152 + pix[p + 2] * 0.0722) / 255;
  }
  return lum;
}
function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function process(canvas, longSide, transparent = false, original = false) {
  const [w, h] = dimensions(longSide);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (original) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }
  let lum;
  if (longSide === 900 && cachedLuma && cachedBlur === params.blur) {
    lum = cachedLuma;
  } else {
    lum = lumaFor(w, h);
    if (longSide === 900) {
      cachedLuma = lum;
      cachedBlur = params.blur;
    }
  }
  const im = ctx.createImageData(w, h),
    a = im.data,
    fg = rgb($("ink").value),
    bg = rgb($("paper").value),
    hist = new Uint32Array(64),
    scale = longSide / 900,
    grain = Math.max(0.5, params.size * scale),
    exp = 2 ** params.exposure,
    inv = $("invert").checked;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let l = inv ? 1 - lum[i] : lum[i];
      l = Math.max(
        0,
        Math.min(
          1,
          ((l * exp - params.black) / Math.max(0.01, 1 - params.black) - 0.5) *
            params.contrast +
            0.5,
        ),
      );
      l = Math.pow(l, 1 / params.gamma);
      let gx = Math.floor(x / grain),
        gy = Math.floor(y / grain);
      const cluster = hash(Math.floor(gx / 4), Math.floor(gy / 4), seed + 19);
      let probability = Math.max(
        0,
        Math.min(
          1,
          l * params.density * (1 + (cluster - 0.5) * params.irregular) -
            params.dissolve * (1 - l) * 0.28,
        ),
      );
      let noise = hash(gx, gy, seed);
      if (params.fiber > 0) {
        const filament = hash(
          Math.floor((x + y * 0.48) / (grain * 0.85)),
          Math.floor(y / (grain * 3.8)),
          seed + 37,
        );
        noise =
          noise * (1 - params.fiber * 0.85) + filament * params.fiber * 0.85;
        probability = probability * 0.8 + 0.08 * l;
      }
      const on = noise < probability;
      const strength = on ? 0.68 + 0.32 * hash(gx, gy, seed + 101) : 0;
      const p = i * 4;
      for (let k = 0; k < 3; k++)
        a[p + k] = transparent ? fg[k] : bg[k] + (fg[k] - bg[k]) * strength;
      a[p + 3] = transparent ? Math.round(strength * 255) : 255;
      hist[Math.min(63, Math.floor(strength * 63))]++;
    }
  ctx.putImageData(im, 0, 0);
  if (longSide === 900) drawHist(hist);
}
function drawHist(hist) {
  const c = $("histogram"),
    ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const max = Math.max(...Array.from(hist).slice(1), 1);
  ctx.fillStyle = "#bbbcb5";
  for (let i = 1; i < 64; i++) {
    const ht = Math.min(77, Math.sqrt(hist[i] / max) * 77);
    ctx.fillRect((i * c.width) / 64, c.height - ht, c.width / 64 - 1, ht);
  }
}
function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const t = performance.now();
    process($("render"), 900, false, showOriginal);
    $("timing").textContent =
      Math.round(performance.now() - t) + " ms / PREVIEW";
    $("seedLabel").textContent = "SEED " + seed;
  });
}
function compare(original) {
  showOriginal = original;
  for (const id of ["original", "processed"]) {
    const active = id === "original" ? original : !original;
    $(id).classList.toggle("active", active);
    $(id).setAttribute("aria-pressed", active);
  }
  schedule();
}
$("original").onclick = () => compare(true);
$("processed").onclick = () => compare(false);
$("random").onclick = () => {
  seed = Math.floor(Math.random() * 999999);
  schedule();
};
$("zoom").onclick = () => {
  const active = $("viewport").classList.toggle("zoom");
  $("zoom").classList.toggle("active", active);
  $("zoom").setAttribute("aria-pressed", active);
  $("zoom").textContent = active ? "Ajustar à janela" : "Zoom 100%";
};
$("torus").onclick = () => loadDemo("torus");
$("sphere").onclick = () => loadDemo("sphere");
document
  .querySelectorAll("[data-preset]")
  .forEach((b) => (b.onclick = () => setPreset(b.dataset.preset)));
$("mobilePreset").onchange = (e) => setPreset(e.target.value);
$("reset").onclick = () => {
  seed = 146642;
  $("ink").value = "#efefea";
  $("paper").value = "#000000";
  $("invert").checked = false;
  setPreset(currentPreset);
};
for (const id of ["ink", "paper", "invert"])
  $(id).addEventListener("input", schedule);
$("upload").onclick = () => $("file").click();
let loadVersion = 0;
async function loadFile(file) {
  if (!file) return;
  const version = ++loadVersion;
  if (
    !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type)
  ) {
    $("notice").textContent = "Use uma imagem PNG, JPG, WebP ou AVIF.";
    return;
  }
  if (file.size > 40 * 1024 * 1024) {
    $("notice").textContent =
      "Arquivo maior que 40 MB. Reduza a imagem e tente de novo.";
    return;
  }
  $("notice").textContent = "Abrindo imagem…";
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (version !== loadVersion) return;
    if (img.naturalWidth * img.naturalHeight > 60000000)
      throw Error("dimension");
    source = img;
    sourceName = file.name;
    demo = null;
    cachedLuma = null;
    updateSource();
    $("torus").classList.remove("active");
    $("sphere").classList.remove("active");
    schedule();
    $("notice").textContent = "Imagem carregada. Ajuste a luz e a textura.";
  } catch {
    $("notice").textContent =
      "Não foi possível abrir. Use uma imagem válida de até 60 megapixels.";
  } finally {
    URL.revokeObjectURL(url);
    $("file").value = "";
  }
}
$("file").onchange = (e) => loadFile(e.target.files[0]);
let dragDepth = 0;
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  $("viewport").classList.remove("drag");
  loadFile(e.dataTransfer.files[0]);
});

$("viewport").addEventListener("dragenter", () => {
  dragDepth++;
  $("viewport").classList.add("drag");
});
$("viewport").addEventListener("dragleave", () => {
  if (--dragDepth <= 0) $("viewport").classList.remove("drag");
});

function loadStored() {
  try {
    const data = JSON.parse(localStorage.getItem("grain-presets") || "[]");
    stored = Array.isArray(data)
      ? data.filter(
          (v) =>
            v &&
            v.params &&
            Object.keys(presets.dust).every((k) =>
              Number.isFinite(v.params[k]),
            ),
        )
      : [];
  } catch {
    stored = [];
  }
  refreshSaved();
}

function refreshSaved() {
  $("saved").replaceChildren(new Option("Selecionar preset", ""));
  stored.forEach((p, i) => $("saved").add(new Option(p.name, i)));
}

$("save").onclick = () => {
  const name = "Preset " + (stored.length + 1);
  stored.push({
    name,
    params: { ...params },
    ink: $("ink").value,
    paper: $("paper").value,
    seed,
    invert: $("invert").checked,
  });

  try {
    localStorage.setItem("grain-presets", JSON.stringify(stored));
    refreshSaved();
    $("savedStatus").textContent = name + " salvo neste navegador.";
  } catch {
    stored.pop();
    $("savedStatus").textContent =
      "Armazenamento indisponível neste navegador.";
  }
};

$("saved").onchange = () => {
  if ($("saved").value === "") return;
  const p = stored[+$("saved").value];
  params = { ...p.params };
  seed = p.seed || 146642;
  $("ink").value = p.ink || "#efefea";
  $("paper").value = p.paper || "#000000";
  $("invert").checked = !!p.invert;
  syncOutputs();
  $("renderState").textContent = p.name.toUpperCase();
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) => b.classList.remove("active"));
  schedule();
};

$("export").onclick = async () => {
  const btn = $("export");
  btn.disabled = true;
  btn.textContent = "Renderizando…";
  $("notice").textContent = "Preparando o PNG com seus ajustes.";
  await new Promise((r) => setTimeout(r, 40));
  try {
    const choice = $("resolution").value,
      n =
        choice === "source"
          ? Math.min(
              4096,
              Math.max(
                source.naturalWidth || source.width,
                source.naturalHeight || source.height,
              ),
            )
          : +choice;
    const c = document.createElement("canvas");
    process(c, n, $("transparent").checked, false);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) throw Error("Export");
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = sourceName.replace(/\.[^.]+$/, "") + "-grain-" + seed + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $("notice").textContent =
      "PNG exportado · " + c.width + " × " + c.height + " px";
  } catch {
    $("notice").textContent =
      "Não foi possível exportar. Tente uma resolução menor.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Exportar PNG";
  }
};
syncOutputs();
loadStored();
loadDemo("torus");
