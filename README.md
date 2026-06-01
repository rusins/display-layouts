# Display Layouts — GNOME Shell Extension

Save and apply monitor layouts from the GNOME quick settings menu.

## Requirements

- GNOME Shell 45–50
- [`gdctl`](https://gitlab.gnome.org/msandova/gdctl) — used to apply saved layouts

Install `gdctl` before enabling the extension, otherwise applying layouts will fail.
(`mutter` package on NixOS)

## Installation

1. **Clone or download this repository**

   ```bash
   git clone https://github.com/rusins/display-layouts.git
   ```

2. **Copy the extension folder**

   ```bash
   cp -r display-layouts/gnome-extension \
     ~/.local/share/gnome-shell/extensions/display-layouts@rusins.github.com
   ```

3. **Enable the extension**

   ```bash
   gnome-extensions enable display-layouts@rusins.github.com
   ```

4. **Log out and back in** (required on Wayland to load the new extension)

## Usage

Open the quick settings panel (top-right corner). A **Display Layouts** toggle will appear.

- Click it to open the layout menu and apply a saved layout.
- Open **Settings → Extensions → Display Layouts → Preferences** to save the current monitor layout or delete saved layouts.

## Development

If you modify `schemas/org.gnome.shell.extensions.display-layouts.gschema.xml`, recompile the schema and commit the result:

```bash
glib-compile-schemas gnome-extension/schemas/
```
