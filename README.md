# message-mirror

## Rofi frontend

A minimal rofi-based launcher for the CLI is available at `scripts/rofi-ui.sh`.

### Dependencies

The script uses system-level tools that must be installed separately:

| Tool | Purpose |
|------|---------|
| `rofi` | UI windows and prompts |
| `jq` | JSON parsing |
| `message-mirror` | The CLI itself (see install below) |
| `wl-clipboard` (`wl-paste` + `wl-copy`) | Clipboard on Wayland |
| `xclip` | Clipboard on X11 |
| `notify-send` *(optional)* | "Analyzing…" notification during processing |

The script detects Wayland vs X11 at runtime via `$WAYLAND_DISPLAY`.

### Install the CLI

The flake exposes `message-mirror` as a Nix package.

**Ad-hoc (nix profile):**

```sh
nix profile install github:skyvier/message-mirror
```

**NixOS system configuration** — add to your `configuration.nix`:

```nix
{ inputs, ... }:
{
  inputs.message-mirror.url = "github:skyvier/message-mirror";

  environment.systemPackages = [
    inputs.message-mirror.packages.${system}.default
  ];
}
```

Or in a flake-based NixOS config, add the input and wire it into `systemPackages`:

```nix
# flake.nix
inputs.message-mirror.url = "github:skyvier/message-mirror";

# configuration.nix
environment.systemPackages = [
  inputs.message-mirror.packages.x86_64-linux.default
];
```

**From a local checkout:**

```sh
nix build
nix profile install ./result
```

Verify it is available:

```sh
message-mirror --version
```

### Make the script executable

```sh
chmod +x scripts/rofi-ui.sh
```

### Bind to a global keybinding

Add a keybinding in your window manager or compositor that runs:

```sh
/path/to/message-mirror/scripts/rofi-ui.sh
```

Example for **Hyprland** (`~/.config/hypr/hyprland.conf`):

```conf
bind = SUPER, M, exec, /path/to/message-mirror/scripts/rofi-ui.sh
```

Example for **Sway** (`~/.config/sway/config`):

```conf
bindsym Mod4+m exec /path/to/message-mirror/scripts/rofi-ui.sh
```

### Usage

Trigger the keybinding. The flow is:

1. **Analysis mode** — choose *Simple* or *Advanced*
   - *Advanced* prompts for relationship, goal, and desired tone (one rofi window each; choose *Skip* to leave any unset)
2. **Input** — choose *From clipboard* or *Write message*
   - *From clipboard* reads the current clipboard contents
   - *Write message* shows a single-line rofi prompt
3. **Analyzing…** — a notification appears while the local model runs (~30–60 s)
4. **Analysis** — intent, emotional tone, and risks are shown; select *Show alternatives →* to continue or press Escape to exit
5. **Alternatives** — three rewrites are listed (*direct*, *warm*, *boundaried*); select one to copy it to clipboard

On a **refusal** (message flagged as manipulative or harmful) the reason is shown and the safer framing suggestion can be selected to copy it to clipboard.

## Development

Enter the pinned development shell:

```sh
nix develop
```

The shell provides the basic TypeScript toolchain:

- Node.js
- pnpm
- TypeScript compiler
- TypeScript language server
- Biome formatter/linter
- jq for JSON fixture work

Quick checks:

```sh
nix develop --command node --version
nix develop --command pnpm --version
nix develop --command tsc --version
nix develop --command typescript-language-server --version
nix develop --command biome --version
```
