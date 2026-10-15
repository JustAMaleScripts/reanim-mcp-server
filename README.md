# reanim-mcp-server

MCP server for **Nooby's uh modded reanimation v1.1.1** (`reanim.luau`) — 52 tools.

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | `reanim_status` | script/workspace/SaveData/module counts |
| 2 | `reanim_list_movesets` | all movesets (builtin + Modules), optional filter |
| 3 | `reanim_list_dances` | all dances incl. packed MARKET, filter + limit |
| 4 | `reanim_check_movesets` | validate moveset catalogue + saved index |
| 5 | `reanim_check_dances` | validate dances, dups, packed count |
| 6 | `reanim_get_current_moveset` | saved MovesetIndex/Hash + resolved name |
| 7 | `reanim_switch_moveset` | persist pick + executor Luau (UI click) |
| 8 | `reanim_get_current_dance` | last MCP dance pick |
| 9 | `reanim_switch_dance` | record pick + executor Luau |
| 10 | `reanim_stop_dance` | clear dance + stop Luau |
| 11 | `reanim_list_dance_keybinds` | Z..P slots + assignments |
| 12 | `reanim_set_dance_keybind` | bind dance to key slot |
| 13 | `reanim_get_ui_theme` | Accent/Harmony/Tri/Intro colors |
| 14 | `reanim_set_ui_theme` | set theme fields |
| 15 | `reanim_get_customization` | full SaveData.Custom |
| 16 | `reanim_set_customization` | set one Custom key |
| 17 | `reanim_reset_customization` | reset Custom to defaults (keeps LowEnd) |
| 18 | `reanim_get_performance` | LowEnd/FX flags |
| 19 | `reanim_set_low_end_mode` | toggle Low End UI Mode |
| 20 | `reanim_list_modules` | files per workspace subdir |
| 21 | `reanim_get_module_info` | parse one module file |
| 22 | `reanim_search_features` | search reanim.luau text (V16-style) |
| 23 | `reanim_get_reanimator_settings` | SelectedReanimator/Fling/CharMove |
| 24 | `reanim_set_reanimator_settings` | update those keys |
| 25 | `reanim_generate_snippet` | Luau snippet without writing files |
| 26 | `reanim_get_savedata` | raw SaveData (hashes hidden by default) |
| 27 | `reanim_create_dance` | scaffold a new dance module in Modules/ |
| 28 | `reanim_create_moveset` | scaffold a new blank moveset module |
| 29 | `reanim_validate_module` | lint a module file (blocks, required fields, dups) |
| 30 | `reanim_remove_module` | safe-delete Modules/ file to .trash/ |
| 31 | `reanim_list_favorites` | radial-wheel favorites (N/Y wheels) |
| 32 | `reanim_add_favorite` | add dance/moveset to wheel favorites |
| 33 | `reanim_remove_favorite` | remove wheel favorite |
| 34 | `reanim_random_dance` | random dance pick + snippet |
| 35 | `reanim_random_moveset` | random moveset pick + snippet |
| 36 | `reanim_surprise_me` | random dance + random theme combo |
| 37 | `reanim_list_theme_presets` | 10 built-in themes (heaven, hell, leafy...) |
| 38 | `reanim_apply_theme_preset` | apply a theme preset |
| 39 | `reanim_list_music` | .mp3 files in Muzik/ + Content/Sounds/ |
| 40 | `reanim_check_module_assets` | missing .anim/.mp3 per module |
| 41 | `reanim_get_audio` | mute flags |
| 42 | `reanim_set_audio` | mute/unmute UI + reanim music/sounds |
| 43 | `reanim_backup_savedata` | timestamped SaveData backup |
| 44 | `reanim_restore_savedata` | list / restore backups (safe) |
| 45 | `reanim_export_profile` | shareable settings JSON |
| 46 | `reanim_import_profile` | import profile (auto-backup first) |
| 47 | `reanim_doctor` | full health check |
| 48 | `reanim_list_root_plugins` | builtin modes + active/disabled RootPart plugins |
| 49 | `reanim_enable_root_plugin` | enable a Plugins/ file |
| 50 | `reanim_disable_root_plugin` | disable to .lua.txt without deleting |
| 51 | `reanim_get_root_settings` | limb mode / velocity / init selections |
| 52 | `reanim_set_root_mode` | persist mode pick + live bridge snippet |

`switch_*` tools update `tree.ehehetilde` for next launch **and** return Luau that
tries to click the matching UI entry live (`firesignal(btn.Activated)` when available).

## Run

```bash
cd reanim-mcp-server
npm install
npm run build
node dist/index.js            # stdio (for MCP clients)
TRANSPORT=http PORT=3001 node dist/index.js
```

## opencode config

```json
{
  "mcp": {
    "servers": {
      "reanim": {
        "type": "local",
        "command": ["node", "<path-to>/reanim-mcp-server/dist/index.js"],
        "environment": {}
      }
    }
  }
}
```

## Connect from another machine / share with others

```bash
git clone <your-repo-url>
cd reanim-mcp-server
npm install
npm run build
node dist/index.js            # stdio (for MCP clients)
```

Point any MCP client at `dist/index.js`:

- **opencode** (`opencode.json` / `opencode.jsonc`): see above.
- **Codex** (`~/.codex/config.toml`):
  ```toml
  [mcp_servers.reanim]
  command = 'node'
  args = ['<path-to>/reanim-mcp-server/dist/index.js']
  startup_timeout_sec = 30
  ```
- **Claude Desktop** (`claude_desktop_config.json`):
  ```json
  {
    "mcpServers": {
      "reanim": {
        "command": "node",
        "args": ["<path-to>/reanim-mcp-server/dist/index.js"]
      }
    }
  }
  ```

Optional env vars: `REANIM_SCRIPT`, `REANIM_WORKSPACE`, `REANIM_SAVEDATA`,
`REANIM_STATE` (defaults target the Real executor paths on Windows).
`TRANSPORT=http PORT=3001` runs a remote-capable HTTP endpoint instead of stdio.

## Executor bridge (optional, for live in-game control)

`bridge-patch*.luau` append a `_G.ReanimMCP` API to `reanim.luau`
(live dance/moveset/rootmode/theme switching). Back up `reanim.luau` first;
every block is `pcall`-guarded and safe to delete.
Use `bridge-patch-all-in-one.luau` for fresh installs (v1.0.0 + v1.0.1 + v1.0.2
in one append); the split files document each version's addition.

