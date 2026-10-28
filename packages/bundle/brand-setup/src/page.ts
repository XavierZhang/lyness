/**
 * The setup document.
 *
 * One self-contained page: no bundler, no client plugin roster, no network
 * origin but its own. It is an operator tool reached from the server's own
 * terminal, so it carries both shipped languages inline and picks one from the
 * browser rather than from a product locale service it cannot reach.
 */

import { BRAND_COLOUR_TOKENS } from '@lyness/lyn-host-brand-deployment'

/** Copy the page shows, in the two languages this product ships. */
const COPY = {
  en: {
    title: 'Brand this deployment',
    intro: 'Generates the mark, wordmark and favicon from one icon, then writes them into this profile\'s patch layer.',
    names: 'Names',
    productName: 'Product name',
    productNameHint: 'Also the wordmark text.',
    abbreviation: 'Abbreviation',
    abbreviationHint: 'Where copy shortens the name. Omit to use the product name.',
    nameZh: 'Chinese name',
    nameZhHint: 'Where Chinese copy names the product. Omit to use the product name.',
    icon: 'Icon',
    iconHint: 'PNG, at least 1024 pixels a side, a dark mark on a light or transparent background.',
    colours: 'Colours',
    themeColor: 'Browser chrome',
    coloursHint: 'Each token keeps its built-in colour until you name one.',
    trademark: 'The name and the icon infringe no trademark.',
    apply: 'Apply brand',
    applying: 'Applying…',
    applied: 'Applied. A running `lyn web` picks the brand up now; another profile applies it on its next start.',
    target: 'Writes to',
  },
  zh: {
    title: '为这个部署设置品牌',
    intro: '从一张图标生成标志、字标与 favicon，并写入该 profile 的补丁层。',
    names: '名称',
    productName: '产品名',
    productNameHint: '同时作为字标文字。',
    abbreviation: '缩写',
    abbreviationHint: '文案需要简称的地方取它。不填则取产品名。',
    nameZh: '中文名',
    nameZhHint: '中文文案称呼产品的地方取它。不填则取产品名。',
    icon: '图标',
    iconHint: 'PNG，边长不小于 1024 像素，浅色或透明背景上的深色图形。',
    colours: '色彩',
    themeColor: '浏览器界面色',
    coloursHint: '没有指定的令牌保留内置颜色。',
    trademark: '确认名称与图标不侵犯商标。',
    apply: '应用品牌',
    applying: '正在应用…',
    applied: '已应用。正在运行的 `lyn web` 立即生效；其他 profile 在下次启动时应用。',
    target: '写入',
  },
} as const

/**
 * Render the setup document.
 *
 * The document takes the token from the address it was opened with, drops it
 * from the address bar, and sends it as a header from then on, so it reaches
 * neither a Referer nor a history entry past the address the operator pasted.
 * @returns the complete HTML document.
 */
export function renderSetupPage(): string {
  const copy = JSON.stringify(COPY)
  const tokens = JSON.stringify(BRAND_COLOUR_TOKENS)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>lyness brand setup</title>
<style>
  :root { color-scheme: light dark; --line: #0001; --muted: #0009; }
  @media (prefers-color-scheme: dark) { :root { --line: #fff2; --muted: #fff9; } }
  body { margin: 0 auto; padding: 32px 20px 64px; max-width: 640px;
    font: 14px/1.6 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
    margin: 32px 0 12px; }
  p.intro, p.hint { color: var(--muted); margin: 4px 0 0; }
  p.hint { font-size: 12px; }
  label { display: block; margin: 16px 0 0; font-weight: 600; }
  input[type=text], input[type=file] { display: block; width: 100%; margin-top: 6px; padding: 8px 10px;
    font: inherit; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; }
  .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 16px; }
  .palette label { font-weight: 400; font-size: 13px; }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 24px; }
  button { font: inherit; font-weight: 600; padding: 10px 18px; border: 0; border-radius: 8px;
    background: #1a73e8; color: #fff; cursor: pointer; }
  button[disabled] { opacity: .5; cursor: default; }
  pre { white-space: pre-wrap; word-break: break-all; border: 1px solid var(--line);
    border-radius: 8px; padding: 12px; margin-top: 20px; }
</style>
</head>
<body>
<h1 id="title"></h1>
<p class="intro" id="intro"></p>
<p class="hint" id="target"></p>

<h2 id="names-heading"></h2>
<label id="label-productName"></label><input type="text" id="productName" autocomplete="off">
<p class="hint" id="hint-productName"></p>
<label id="label-abbreviation"></label><input type="text" id="productAbbreviation" autocomplete="off">
<p class="hint" id="hint-abbreviation"></p>
<label id="label-nameZh"></label><input type="text" id="productNameZh" autocomplete="off">
<p class="hint" id="hint-nameZh"></p>

<h2 id="icon-heading"></h2>
<input type="file" id="icon" accept="image/png">
<p class="hint" id="hint-icon"></p>

<h2 id="colours-heading"></h2>
<label id="label-themeColor"></label><input type="text" id="themeColor" autocomplete="off" placeholder="#1a73e8">
<p class="hint" id="hint-colours"></p>
<div class="palette" id="palette"></div>

<div class="row">
  <input type="checkbox" id="trademark">
  <label for="trademark" id="label-trademark" style="margin:0;font-weight:400"></label>
</div>
<div class="row"><button id="apply" type="button"></button></div>
<pre id="result" hidden></pre>

<script>
const TOKEN = new URL(location.href).searchParams.get('token') ?? ''
history.replaceState(null, '', location.pathname)
const COPY = ${copy}
const TOKENS = ${tokens}
const t = COPY[navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en']
const $ = (id) => document.getElementById(id)

$('title').textContent = t.title
$('intro').textContent = t.intro
$('names-heading').textContent = t.names
$('icon-heading').textContent = t.icon
$('colours-heading').textContent = t.colours
$('label-productName').textContent = t.productName
$('hint-productName').textContent = t.productNameHint
$('label-abbreviation').textContent = t.abbreviation
$('hint-abbreviation').textContent = t.abbreviationHint
$('label-nameZh').textContent = t.nameZh
$('hint-nameZh').textContent = t.nameZhHint
$('hint-icon').textContent = t.iconHint
$('label-themeColor').textContent = t.themeColor
$('hint-colours').textContent = t.coloursHint
$('label-trademark').textContent = t.trademark
$('apply').textContent = t.apply

for (const token of TOKENS) {
  const label = document.createElement('label')
  label.textContent = token
  const input = document.createElement('input')
  input.type = 'text'
  input.dataset.token = token
  input.autocomplete = 'off'
  label.appendChild(input)
  $('palette').appendChild(label)
}

const send = (path, options) => fetch(path, {
  ...options,
  headers: { 'x-lyn-setup-token': TOKEN, ...options?.headers },
})

send('/state').then((response) => response.json()).then((state) => {
  $('target').textContent = t.target + ' ' + state.patchPath
  for (const [key, value] of Object.entries(state.config)) {
    const field = $(key)
    if (field) field.value = value
  }
  for (const [token, value] of Object.entries(state.colors)) {
    const field = document.querySelector('[data-token="' + token + '"]')
    if (field) field.value = value
  }
}).catch(() => {})

const readIcon = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => { reject(new Error('the icon could not be read')) }
  reader.onload = () => { resolve(String(reader.result).split(',')[1] ?? '') }
  reader.readAsDataURL(file)
})

$('apply').addEventListener('click', async () => {
  const button = $('apply')
  const result = $('result')
  button.disabled = true
  button.textContent = t.applying
  result.hidden = false
  result.textContent = t.applying
  try {
    const file = $('icon').files[0]
    const colors = {}
    for (const input of document.querySelectorAll('[data-token]')) {
      if (input.value.trim() !== '') colors[input.dataset.token] = input.value.trim()
    }
    const response = await send('/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productName: $('productName').value.trim(),
        productAbbreviation: $('productAbbreviation').value.trim(),
        productNameZh: $('productNameZh').value.trim(),
        themeColor: $('themeColor').value.trim(),
        colors,
        acceptTrademark: $('trademark').checked,
        icon: file ? await readIcon(file) : '',
      }),
    })
    const body = await response.json()
    result.textContent = response.ok
      ? t.applied + '\\n\\n' + Object.values(body.assets).join('\\n')
      : body.error
  } catch (error) {
    result.textContent = String(error)
  } finally {
    button.disabled = false
    button.textContent = t.apply
  }
})
</script>
</body>
</html>
`
}
