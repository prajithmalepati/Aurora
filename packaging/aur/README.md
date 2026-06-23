# Aurora — Arch Linux (AUR) Packaging

## Variants

### `aurora-git` (build from source)

Builds the latest tagged release.

```bash
# Clone and install
git clone https://aur.archlinux.org/aurora-git.git
cd aurora-git
makepkg -si
```

**Build dependencies:** nodejs, npm, rust, python, python-pip, dpkg
**Runtime dependencies:** webkit2gtk-4.1, openssl, glib2

The build freezes the Python backend with PyInstaller, then compiles the Tauri
desktop app. The resulting package extracts from the built `.deb`.

### `aurora-bin` (pre-built binary — future)

Will fetch a published GitHub release `.deb`. Available after the first public
release with a `.deb` asset on the
[Releases](https://github.com/prajithmalepati/Aurora/releases) page.

## Notes

- **Not published to AUR yet** — requires the maintainer's AUR account and SSH key.
- The `aurora-git` PKGBUILD builds the full desktop app including the frozen
  Python backend sidecar. No Python installation needed at runtime.
- For LAN/mobile access: `AURORA_HOST=0.0.0.0 Aurora`
