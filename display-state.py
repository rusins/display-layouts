#!/usr/bin/env python3
"""display-state: save and apply monitor layouts on GNOME Wayland (proof of concept)"""

import subprocess

import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio

DBUS_NAME = 'org.gnome.Mutter.DisplayConfig'
DBUS_PATH = '/org/gnome/Mutter/DisplayConfig'
DBUS_IFACE = 'org.gnome.Mutter.DisplayConfig'

TRANSFORM_NAMES = {
    0: 'normal', 1: '90', 2: '180', 3: '270',
    4: 'flipped', 5: 'flipped-90', 6: 'flipped-180', 7: 'flipped-270',
}


def get_current_state():
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    proxy = Gio.DBusProxy.new_sync(
        bus, Gio.DBusProxyFlags.NONE, None,
        DBUS_NAME, DBUS_PATH, DBUS_IFACE, None
    )
    return proxy.call_sync('GetCurrentState', None, Gio.DBusCallFlags.NONE, -1, None).unpack()


def capture_layout():
    """Read current monitor state and return as a list of monitor dicts."""
    _serial, monitors, logical_monitors, _props = get_current_state()

    # Find the active mode for each connector
    current_modes = {}
    for (connector, _vendor, _product, _serial), modes, _props in monitors:
        for mode_id, *_rest, mode_props in modes:
            if mode_props.get('is-current'):
                current_modes[connector] = mode_id
                break

    # Build layout from logical monitors (only active monitors appear here)
    layout = []
    for lm in logical_monitors:
        x, y, scale, transform, is_primary, mon_list = lm[0], lm[1], lm[2], lm[3], lm[4], lm[5]
        for connector, *_ident in mon_list:
            layout.append({
                'connector': connector,
                'mode': current_modes.get(connector),
                'x': x,
                'y': y,
                'scale': float(scale),
                'transform': int(transform),
                'primary': bool(is_primary),
            })
    return layout


def layout_to_gdctl_cmd(layout):
    args = ['gdctl', 'set']
    for mon in layout:
        args += ['-L']
        if mon['primary']:
            args += ['--primary']
        args += ['-M', mon['connector']]
        if mon['mode']:
            args += ['--mode', mon['mode']]
        args += ['--x', str(mon['x']), '--y', str(mon['y'])]
        args += ['--scale', str(mon['scale'])]
        transform = TRANSFORM_NAMES.get(mon['transform'], 'normal')
        if transform != 'normal':
            args += ['--transform', transform]
    return args


def apply_layout(layout):
    args = layout_to_gdctl_cmd(layout)
    print('Running:', ' '.join(args))
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'Error: {result.stderr.strip()}')
    else:
        print('Applied.')


def describe_layout(layout):
    lines = []
    for mon in layout:
        primary = ' [primary]' if mon['primary'] else ''
        transform = TRANSFORM_NAMES.get(mon['transform'], '?')
        t_str = f' transform={transform}' if transform != 'normal' else ''
        lines.append(f"  {mon['connector']}: {mon['mode']} at ({mon['x']},{mon['y']}) scale={mon['scale']}{t_str}{primary}")
    return '\n'.join(lines) if lines else '  (no active monitors)'


def main():
    presets = {}
    print("display-state — type 'help' for commands")

    while True:
        try:
            raw = input('> ').strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not raw:
            continue

        parts = raw.split(maxsplit=1)
        cmd = parts[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else None

        if cmd == 'help':
            print('  show              show current layout')
            print('  save <name>       save current layout as a preset')
            print('  apply <name>      apply a saved preset')
            print('  list              list all saved presets')
            print('  quit              exit')

        elif cmd == 'show':
            try:
                print('Current layout:')
                print(describe_layout(capture_layout()))
            except Exception as e:
                print(f'Error: {e}')

        elif cmd == 'save':
            if not arg:
                print('Usage: save <name>')
            else:
                try:
                    presets[arg] = capture_layout()
                    print(f"Saved '{arg}'.")
                except Exception as e:
                    print(f'Error: {e}')

        elif cmd == 'apply':
            if not arg:
                print('Usage: apply <name>')
            elif arg not in presets:
                print(f"No preset '{arg}'. Saved: {list(presets) or 'none'}")
            else:
                apply_layout(presets[arg])

        elif cmd == 'list':
            if not presets:
                print('No presets saved.')
            else:
                for name, layout in presets.items():
                    print(f'{name}:')
                    print(describe_layout(layout))

        elif cmd in ('quit', 'exit', 'q'):
            break

        else:
            print(f"Unknown command '{cmd}'. Type 'help'.")


if __name__ == '__main__':
    main()
