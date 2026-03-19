import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function captureCurrentLayout() {
    const proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SESSION,
        Gio.DBusProxyFlags.NONE,
        null,
        'org.gnome.Mutter.DisplayConfig',
        '/org/gnome/Mutter/DisplayConfig',
        'org.gnome.Mutter.DisplayConfig',
        null
    );

    const result = proxy.call_sync('GetCurrentState', null, Gio.DBusCallFlags.NONE, -1, null);
    const [, monitors, logicalMonitors] = result.deepUnpack();

    // Find the active mode for each connector
    const currentModes = {};
    for (const [connInfo, modes] of monitors) {
        const [connector] = connInfo;
        for (const mode of modes) {
            const modeId = mode[0];
            const modeProps = mode[6];
            if (modeProps['is-current']) {
                currentModes[connector] = modeId;
                break;
            }
        }
    }

    // Build layout from active logical monitors
    const layout = [];
    for (const lm of logicalMonitors) {
        const [x, y, scale, transform, isPrimary, monList] = lm;
        for (const [connector] of monList) {
            layout.push({
                connector,
                mode: currentModes[connector] ?? null,
                x: Number(x),
                y: Number(y),
                scale: Number(scale),
                transform: Number(transform),
                primary: Boolean(isPrimary),
            });
        }
    }
    return layout;
}

export default class DisplayStatePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Layouts',
            iconName: 'video-display-symbolic',
        });
        window.add(page);

        // ── Save current layout ──────────────────────────────────────
        const saveGroup = new Adw.PreferencesGroup({ title: 'Save Current Layout' });
        page.add(saveGroup);

        const nameRow = new Adw.EntryRow({ title: 'Layout name' });
        saveGroup.add(nameRow);

        const saveButton = new Gtk.Button({
            label: 'Save',
            halign: Gtk.Align.END,
            cssClasses: ['suggested-action'],
            marginTop: 8,
            marginBottom: 4,
        });
        saveGroup.add(saveButton);

        saveButton.connect('clicked', () => {
            const name = nameRow.text.trim();
            if (!name) return;
            try {
                const layout = captureCurrentLayout();
                const layouts = JSON.parse(settings.get_string('layouts'));
                layouts[name] = layout;
                settings.set_string('layouts', JSON.stringify(layouts));
                nameRow.text = '';
            } catch (e) {
                console.error('Display State prefs:', e);
            }
        });

        // ── Saved layouts ────────────────────────────────────────────
        const layoutsGroup = new Adw.PreferencesGroup({ title: 'Saved Layouts' });
        page.add(layoutsGroup);

        this._layoutsGroup = layoutsGroup;
        this._layoutRows = [];
        this._refreshLayouts(settings);

        settings.connect('changed::layouts', () => this._refreshLayouts(settings));
    }

    _refreshLayouts(settings) {
        const group = this._layoutsGroup;

        for (const row of this._layoutRows)
            group.remove(row);
        this._layoutRows = [];

        let layouts;
        try {
            layouts = JSON.parse(settings.get_string('layouts'));
        } catch {
            layouts = {};
        }

        const names = Object.keys(layouts);

        if (names.length === 0) {
            const row = new Adw.ActionRow({ title: 'No saved layouts', sensitive: false });
            group.add(row);
            this._layoutRows.push(row);
            return;
        }

        for (const name of names) {
            const monitors = layouts[name].map(m => m.connector).join(', ');
            const row = new Adw.ActionRow({ title: name, subtitle: monitors });

            const deleteButton = new Gtk.Button({
                iconName: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                cssClasses: ['destructive-action', 'flat'],
            });
            deleteButton.connect('clicked', () => {
                const current = JSON.parse(settings.get_string('layouts'));
                delete current[name];
                settings.set_string('layouts', JSON.stringify(current));
            });

            row.add_suffix(deleteButton);
            group.add(row);
            this._layoutRows.push(row);
        }
    }
}
