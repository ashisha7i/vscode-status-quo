# Status Quo
_Simple Status Bar Customizer_

---

Working with multiple VS Code windows at the same time? _Status Quo_ makes it easy to give some personality to each of the window so you can quickly identify them at a glance. Show your own text in the VS Code status bar and give each project its own status bar color. 

## Features

- **Custom status bar text.** Click the text item in the left of the status bar to edit it.
- **Per-project status bar color.** Click the palette icon next to it to choose a color:
  - Preset colors, shown with color swatches in the list
  - A color picker with a live preview of your status bar
  - A hex input (`#ff8800` or `#f80`)
  - Reset to your theme's default
- **Remembers your current color.** The list highlights it, and the color picker and hex input both open on it.
- **Readable text automatically.** The status bar foreground switches between black and white depending on how light the background is.

## Screenshot
![Screenshot](images/screenshot.png)

## Usage

Open a folder or workspace, then use either the status bar items or the Command Palette (`Cmd/Ctrl+Shift+P`):

| Command | What it does |
| --- | --- |
| `Status Quo: Edit Text` | Change the text shown in the status bar |
| `Status Quo: Change Color` | Pick, enter, or reset the status bar color |

The status bar items only appear when a folder or workspace is open.

## Where settings are stored

Everything is saved at the **workspace level only**. Your user (global) settings are never modified.

- Single folder open: `.vscode/settings.json`
- `.code-workspace` file open: the `settings` section of that file

The extension writes two keys:

- `workbench.colorCustomizations` → `statusBar.background` and `statusBar.foreground`
- `statusQuo.text`

Other entries in `workbench.colorCustomizations` are left untouched. If you don't want these settings committed, add `.vscode/settings.json` to your `.gitignore`.

## Extension settings

| Setting | Default | Description |
| --- | --- | --- |
| `statusQuo.text` | `Click to edit` | The text shown in the status bar (workspace setting) |

## Known limitations

- A folder or workspace must be open. There is no global (all-projects) mode.
- "Current color" means the color this extension saved in the workspace settings. A status bar color coming from your theme or user settings is not detected.
- Only `#rgb` and `#rrggbb` hex values are supported.

## Requirements

VS Code 1.85.0 or newer.

## Release notes

See the Changelog tab on this page for what changed in each version.
