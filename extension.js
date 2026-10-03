const vscode = require('vscode');
const crypto = require('crypto');

// Predefined colors shown in the picker
const PRESET_COLORS = [
  { label: 'Blue',   hex: '#007acc' },
  { label: 'Green',  hex: '#2e7d32' },
  { label: 'Purple', hex: '#6a1b9a' },
  { label: 'Orange', hex: '#e65100' },
  { label: 'Red',    hex: '#c62828' },
  { label: 'Teal',   hex: '#00796b' },
  { label: 'Pink',   hex: '#d81b60' },
  { label: 'Gray',   hex: '#455a64' },
];

// Theme color keys this extension writes to workbench.colorCustomizations
const COLOR_KEYS = ['statusBar.background', 'statusBar.foreground'];

const PICKER_LABEL = '$(symbol-color) Open color picker...';
const CUSTOM_HEX_LABEL = '$(edit) Enter hex value...';
const RESET_LABEL = '$(discard) Reset to theme default';

// Starting point for the picker when no color has been set yet (VS Code's default blue).
const DEFAULT_PICKER_COLOR = '#007acc';

/**
 * A project is open when there is at least one folder, or a .code-workspace
 * (saved or untitled) is open.
 */
function hasProject() {
  return Boolean(vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile);
}

/**
 * ConfigurationTarget.Workspace writes to:
 *  - the .code-workspace file's "settings" section when a workspace file is open
 *  - <folder>/.vscode/settings.json when a single folder is open
 * We never write to user (global) settings.
 */
const TARGET = vscode.ConfigurationTarget.Workspace;

function requireProject() {
  if (hasProject()) return true;
  vscode.window
    .showInformationMessage(
      'Status Quo only works when a folder or workspace is open.',
      'Open Folder'
    )
    .then((choice) => {
      if (choice === 'Open Folder') {
        vscode.commands.executeCommand('workbench.action.files.openFolder');
      }
    });
  return false;
}

/** Accepts #rgb, #rrggbb (with or without '#'); returns "#rrggbb" or undefined. */
function normalizeHex(input) {
  if (typeof input !== 'string') return undefined;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return undefined;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  return `#${hex.toLowerCase()}`;
}

/** Pick black or white text depending on how light the background is. */
function readableForeground(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

async function updateColorCustomizations(mutate) {
  const config = vscode.workspace.getConfiguration();
  const inspected = config.inspect('workbench.colorCustomizations');
  // Only start from what is already in the workspace-level settings,
  // so nothing from user settings gets copied into the project.
  const existing = inspected?.workspaceValue || {};

  const updated = mutate({ ...existing });
  const isEmpty = Object.keys(updated).length === 0;
  await config.update('workbench.colorCustomizations', isEmpty ? undefined : updated, TARGET);
}

async function applyColor(hex) {
  await updateColorCustomizations((colors) => {
    colors['statusBar.background'] = hex;
    colors['statusBar.foreground'] = readableForeground(hex);
    return colors;
  });
}

async function resetColor() {
  await updateColorCustomizations((colors) => {
    COLOR_KEYS.forEach((key) => delete colors[key]);
    return colors;
  });
}

/** The status bar color this extension last wrote to the workspace settings, if any. */
function getCurrentColor() {
  const inspected = vscode.workspace.getConfiguration().inspect('workbench.colorCustomizations');
  return normalizeHex(inspected?.workspaceValue?.['statusBar.background']);
}

/** Small rounded color square, used as the icon next to each quick pick item. */
function swatchIcon(hex) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
    `<rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}" ` +
    'stroke="#808080" stroke-opacity="0.6" stroke-width="1"/></svg>';
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

async function promptForCustomHex(current) {
  const value = await vscode.window.showInputBox({
    title: 'Custom status bar color',
    prompt: 'Enter a hex color, e.g. #ff8800 or #f80',
    placeHolder: '#RRGGBB',
    value: current ?? '',
    valueSelection: current ? [0, current.length] : undefined,
    validateInput: (text) =>
      normalizeHex(text) ? undefined : 'Enter a valid hex color like #ff8800 or #f80',
  });
  return value ? normalizeHex(value) : undefined;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getPickerHtml(initialHex, previewText) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 24px; max-width: 420px; }
  h2 { font-weight: 600; margin: 0 0 16px; }
  .row { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
  input[type=color] { width: 72px; height: 72px; padding: 0; border: 1px solid var(--vscode-input-border, #808080); background: none; cursor: pointer; border-radius: 6px; }
  input[type=text] { width: 110px; padding: 6px 8px; font-family: var(--vscode-editor-font-family); font-size: 14px;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; }
  input[type=text].invalid { border-color: var(--vscode-inputValidation-errorBorder, #f14c4c); }
  input[type=text]:focus { outline: 1px solid var(--vscode-focusBorder); }
  .hint { opacity: 0.7; font-size: 12px; margin: 0 0 20px; }
  .label { font-size: 12px; opacity: 0.7; margin-bottom: 6px; }
  #preview { display: flex; align-items: center; height: 24px; padding: 0 10px; font-size: 12px; border-radius: 3px; margin-bottom: 8px; }
  .note { opacity: 0.7; font-size: 12px; margin: 0 0 24px; line-height: 1.4; }
  .note code { font-family: var(--vscode-editor-font-family); font-size: 11px; }
  .buttons { display: flex; gap: 8px; }
  button { padding: 6px 14px; border: none; border-radius: 2px; cursor: pointer; font-family: inherit;
    color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>
  <h2>Status bar color</h2>
  <div class="row">
    <input type="color" id="picker" value="${initialHex}" aria-label="Color picker">
    <input type="text" id="hex" value="${initialHex}" maxlength="7" spellcheck="false" aria-label="Hex value">
  </div>
  <p class="hint">Click the square to open the picker, or type a hex value.</p>
  <div class="label">Preview</div>
  <div id="preview">${escapeHtml(previewText)}</div>
  <p class="note">Icons like <code>$(coffee)</code> are shown as plain text in this preview, but they render as icons in the status bar.</p>
  <div class="buttons">
    <button id="apply">Apply</button>
    <button id="cancel" class="secondary">Cancel</button>
  </div>
<script nonce="${nonce}">
  var vscode = acquireVsCodeApi();
  var picker = document.getElementById('picker');
  var hexInput = document.getElementById('hex');
  var preview = document.getElementById('preview');
  var applyBtn = document.getElementById('apply');

  function normalize(v) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return '#' + h.toLowerCase();
  }
  function readable(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000000' : '#ffffff';
  }
  function render(hex) {
    preview.style.background = hex;
    preview.style.color = readable(hex);
  }

  picker.addEventListener('input', function () {
    hexInput.value = picker.value;
    hexInput.classList.remove('invalid');
    applyBtn.disabled = false;
    render(picker.value);
  });
  hexInput.addEventListener('input', function () {
    var n = normalize(hexInput.value);
    hexInput.classList.toggle('invalid', !n);
    applyBtn.disabled = !n;
    if (n) { picker.value = n; render(n); }
  });
  applyBtn.addEventListener('click', function () {
    var n = normalize(hexInput.value);
    if (n) vscode.postMessage({ type: 'apply', hex: n });
  });
  document.getElementById('cancel').addEventListener('click', function () {
    vscode.postMessage({ type: 'cancel' });
  });

  render(picker.value);
</script>
</body>
</html>`;
}

/** Opens a webview with a native color input. Resolves to "#rrggbb" or undefined if cancelled. */
function openColorPickerPanel(initialHex, previewText) {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'statusQuo.picker',
      'Status Bar Color',
      vscode.ViewColumn.Active,
      { enableScripts: true }
    );
    let result;
    panel.webview.html = getPickerHtml(initialHex, previewText);
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === 'apply') result = normalizeHex(msg.hex);
      panel.dispose();
    });
    panel.onDidDispose(() => resolve(result));
  });
}

/** Quick pick with a pre-highlighted item. Resolves to the chosen item or undefined. */
function showQuickPick(items, { title, placeHolder, active }) {
  return new Promise((resolve) => {
    const qp = vscode.window.createQuickPick();
    qp.title = title;
    qp.placeholder = placeHolder;
    qp.items = items;
    if (active) qp.activeItems = [active];
    let result;
    qp.onDidAccept(() => {
      result = qp.selectedItems[0];
      qp.hide();
    });
    qp.onDidHide(() => {
      qp.dispose();
      resolve(result);
    });
    qp.show();
  });
}

async function changeColor() {
  if (!requireProject()) return;

  const current = getCurrentColor();

  const presetItems = PRESET_COLORS.map((c) => ({
    label: c.label,
    description: c.hex === current ? `${c.hex}  (current)` : c.hex,
    iconPath: swatchIcon(c.hex),
    hex: c.hex,
  }));

  // If the current color isn't one of the presets, show it at the top so it's visible.
  const currentIsPreset = presetItems.some((i) => i.hex === current);
  const currentItem =
    current && !currentIsPreset
      ? { label: 'Current color', description: `${current}  (current)`, iconPath: swatchIcon(current), hex: current }
      : undefined;

  const items = [
    ...(currentItem ? [currentItem, { label: '', kind: vscode.QuickPickItemKind.Separator }] : []),
    ...presetItems,
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { label: PICKER_LABEL, picker: true },
    { label: CUSTOM_HEX_LABEL, custom: true },
    { label: RESET_LABEL, reset: true },
  ];

  const picked = await showQuickPick(items, {
    title: 'Change status bar color',
    placeHolder: 'Choose a color, open the color picker, or enter a hex value',
    active: currentItem ?? presetItems.find((i) => i.hex === current),
  });
  if (!picked) return;

  if (picked.reset) {
    await resetColor();
    return;
  }

  let hex;
  if (picked.picker) {
    const text = vscode.workspace.getConfiguration('statusQuo').get('text', '');
    hex = await openColorPickerPanel(current ?? DEFAULT_PICKER_COLOR, text);
  } else if (picked.custom) {
    hex = await promptForCustomHex(current);
  } else {
    hex = picked.hex;
  }
  if (hex) {
    await applyColor(hex);
  }
}

async function editText() {
  if (!requireProject()) return;

  const config = vscode.workspace.getConfiguration('statusQuo');
  const current = config.get('text', '');

  const value = await vscode.window.showInputBox({
    title: 'Status bar text',
    prompt: 'Enter the text to show in the status bar',
    value: current,
    validateInput: (text) => (text.trim() ? undefined : 'Text cannot be empty'),
  });
  if (value !== undefined) {
    await config.update('text', value.trim(), TARGET);
  }
}

/** Run a command handler and show any failure (e.g. unwritable settings file). */
function safe(handler) {
  return async () => {
    try {
      await handler();
    } catch (err) {
      vscode.window.showErrorMessage(`Status Quo: ${err?.message ?? err}`);
    }
  };
}

function activate(context) {
  // Text item (click to edit)
  const textItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  textItem.command = 'statusQuo.editText';
  textItem.tooltip = 'Click to edit this text';

  // Palette icon (click to change color)
  const colorItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  colorItem.text = '$(symbol-color)';
  colorItem.command = 'statusQuo.changeColor';
  colorItem.tooltip = 'Change status bar color';

  const refresh = () => {
    const text = vscode.workspace.getConfiguration('statusQuo').get('text', 'Click to edit');
    textItem.text = `$(edit) ${text}`;
    if (hasProject()) {
      textItem.show();
      colorItem.show();
    } else {
      textItem.hide();
      colorItem.hide();
    }
  };
  refresh();

  context.subscriptions.push(
    textItem,
    colorItem,
    vscode.commands.registerCommand('statusQuo.editText', safe(editText)),
    vscode.commands.registerCommand('statusQuo.changeColor', safe(changeColor)),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('statusQuo.text')) refresh();
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
