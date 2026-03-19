import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const { QuickMenuToggle, SystemIndicator } = QuickSettings;

const TRANSFORMS = ['normal', '90', '180', '270', 'flipped', 'flipped-90', 'flipped-180', 'flipped-270'];

function layoutToArgs(layout) {
    const args = [];
    for (const mon of layout) {
        args.push('-L');
        if (mon.primary) args.push('--primary');
        args.push('-M', mon.connector);
        if (mon.mode) args.push('--mode', mon.mode);
        args.push('--x', String(mon.x), '--y', String(mon.y));
        args.push('--scale', String(mon.scale));
        const t = TRANSFORMS[mon.transform] ?? 'normal';
        if (t !== 'normal') args.push('--transform', t);
    }
    return args;
}

const DisplayStateToggle = GObject.registerClass(
class DisplayStateToggle extends QuickMenuToggle {
    _init(settings) {
        super._init({
            title: 'Display Layout',
            iconName: 'video-display-symbolic',
            toggleMode: false,
        });

        this._settings = settings;
        this.menu.setHeader('video-display-symbolic', 'Display Layouts');
        this._rebuild();
        this._changedId = this._settings.connect('changed::layouts', () => this._rebuild());
    }

    _rebuild() {
        this.menu.removeAll();

        let layouts;
        try {
            layouts = JSON.parse(this._settings.get_string('layouts'));
        } catch {
            layouts = {};
        }

        const names = Object.keys(layouts);
        if (names.length === 0) {
            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem('No saved layouts', { reactive: false })
            );
            return;
        }

        for (const name of names) {
            const item = new PopupMenu.PopupMenuItem(name);
            item.connect('activate', () => this._apply(layouts[name]));
            this.menu.addMenuItem(item);
        }
    }

    _apply(layout) {
        const argv = ['gdctl', 'set', ...layoutToArgs(layout)];
        try {
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, , stderr] = p.communicate_utf8_finish(res);
                    if (!p.get_successful())
                        Main.notifyError('Display State', stderr?.trim() || 'Failed to apply layout');
                } catch (e) {
                    console.error('Display State:', e);
                }
            });
        } catch (e) {
            console.error('Display State:', e);
        }
    }

    destroy() {
        this._settings.disconnect(this._changedId);
        super.destroy();
    }
});

const DisplayStateIndicator = GObject.registerClass(
class DisplayStateIndicator extends SystemIndicator {
    _init(settings) {
        super._init();
        this._toggle = new DisplayStateToggle(settings);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});

export default class DisplayStateExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new DisplayStateIndicator(this._settings);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
