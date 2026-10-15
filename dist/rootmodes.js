import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { readSaveData, resolvePaths, writeSaveData } from "./store.js";
function ok(data, text) {
    return {
        content: [{ type: "text", text: text ?? JSON.stringify(data, null, 2) }],
        structuredContent: data,
    };
}
function err(message) {
    return { content: [{ type: "text", text: `Error: ${message}` }] };
}
const NoArgs = z.object({}).strict();
export const BUILTIN_ROOT_MODES = [
    "RootPart in very void", "RootPart in void", "Keep RootPart Streamed",
    "CurrentAngle Style", "RootPart is Torso", "RootPart in sky", "RootPart in very sky",
];
const VELOCITY_NAMES = ["No Velocity", "Follow Character", "Fling-like"];
const INIT_NAMES = ["Reset Character", "CDSB + Reset", "CDSB + SSE + Kill"];
function escLuau(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
function pluginDir() {
    return path.join(resolvePaths().workspace, "Plugins");
}
function parsePluginName(filePath) {
    try {
        const text = fs.readFileSync(filePath, "utf-8");
        return text.match(/Name\s*=\s*"([^"]+)"/)?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function scanPlugins() {
    const dir = pluginDir();
    const active = [];
    const disabled = [];
    let files = [];
    try {
        files = fs.readdirSync(dir).sort();
    }
    catch {
        return { active, disabled };
    }
    for (const f of files) {
        const full = path.join(dir, f);
        try {
            if (!fs.statSync(full).isFile())
                continue;
        }
        catch {
            continue;
        }
        const low = f.toLowerCase();
        if (low.endsWith(".lua"))
            active.push({ file: f, name: parsePluginName(full) });
        else if (low.endsWith(".lua.txt") || low.endsWith(".lua.disabled"))
            disabled.push({ file: f, name: parsePluginName(full) });
    }
    return { active, disabled };
}
export function registerRootTools(server) {
    server.registerTool("reanim_list_root_plugins", {
        title: "List RootPart plugins",
        description: "List builtin RootPart modes (0-6), active/disabled Plugins/ files with parsed names, and the currently selected mode.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const r = (data.Reanimator ?? {});
            const scan = scanPlugins();
            return ok({
                builtin: BUILTIN_ROOT_MODES.map((name, i) => ({ slot: i, name })),
                active: scan.active, disabled: scan.disabled,
                selected: { LimbMode: r.LimbMode ?? null, LimbModeName: r.LimbModeName ?? null, LimbVelocity: r.LimbVelocity ?? null, LimbInitMode: r.LimbInitMode ?? null },
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    server.registerTool("reanim_enable_root_plugin", {
        title: "Enable RootPart plugin",
        description: "Enable a disabled plugin (.lua.txt -> .lua). Takes effect on re-run. Never touches README.",
        inputSchema: z.object({ file: z.string().min(1).describe("Disabled plugin filename, e.g. VoidAnchor.lua.txt") }).strict(),
        annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const base = path.basename(a.file);
            if (base.toLowerCase() === "readme.txt")
                return err("Refusing: README is not a plugin");
            const src = path.join(pluginDir(), base);
            if (!fs.existsSync(src))
                return err(`Not found in Plugins/: ${base}`);
            if (!/\.lua\.(txt|disabled)$/i.test(base))
                return err(`${base} is not a disabled plugin (expected .lua.txt or .lua.disabled)`);
            const dest = path.join(pluginDir(), base.replace(/\.lua\.(txt|disabled)$/i, ".lua"));
            if (fs.existsSync(dest))
                return err(`${path.basename(dest)} already exists`);
            fs.renameSync(src, dest);
            return ok({ enabled: path.basename(dest) }, `Enabled ${path.basename(dest)}. Re-run reanim.luau to load it as a RootPart mode.`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    server.registerTool("reanim_disable_root_plugin", {
        title: "Disable RootPart plugin",
        description: "Disable an active plugin (.lua -> .lua.txt) without deleting it. Takes effect on re-run.",
        inputSchema: z.object({ file: z.string().min(1).describe("Active plugin filename, e.g. VoidAnchor.lua") }).strict(),
        annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const base = path.basename(a.file);
            if (base.toLowerCase() === "readme.txt")
                return err("Refusing: README is not a plugin");
            const src = path.join(pluginDir(), base);
            if (!fs.existsSync(src))
                return err(`Not found in Plugins/: ${base}`);
            if (!base.toLowerCase().endsWith(".lua"))
                return err(`${base} is not an active plugin`);
            const dest = path.join(pluginDir(), `${base}.txt`);
            if (fs.existsSync(dest))
                return err(`${path.basename(dest)} already exists`);
            fs.renameSync(src, dest);
            return ok({ disabled: path.basename(dest) }, `Disabled ${base} (kept as ${path.basename(dest)}). Re-run reanim.luau to unload it.`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    server.registerTool("reanim_get_root_settings", {
        title: "Get RootPart settings",
        description: "Read limb RootPart mode / velocity / init selections with human-readable names.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const r = (data.Reanimator ?? {});
            const mode = typeof r.LimbMode === "number" ? r.LimbMode : null;
            return ok({
                LimbMode: mode,
                LimbModeName: r.LimbModeName ?? (mode !== null && BUILTIN_ROOT_MODES[mode]) ?? null,
                LimbVelocity: r.LimbVelocity ?? null,
                LimbVelocityName: VELOCITY_NAMES[r.LimbVelocity] ?? null,
                LimbInitMode: r.LimbInitMode ?? null,
                LimbInitName: INIT_NAMES[r.LimbInitMode] ?? null,
                velocityOptions: VELOCITY_NAMES, initOptions: INIT_NAMES,
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    server.registerTool("reanim_set_root_mode", {
        title: "Set RootPart mode",
        description: "Persist a RootPart mode pick (builtin 0-6 by index or name, or active plugin by exact name) and return the live bridge snippet (_G.ReanimMCP.SetRootMode). Re-run to load newly enabled plugins.",
        inputSchema: z.object({
            mode: z.union([z.string(), z.number()]).describe("Builtin index 0-6, mode name, or active plugin name (e.g. 'Gelatek Root-Pin (experimental)')"),
            velocity: z.number().int().min(0).max(2).optional().describe("0 none, 1 follow, 2 fling-like"),
        }).strict(), annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const scan = scanPlugins();
            const activeNames = scan.active.map((p) => p.name).filter((n) => !!n);
            let slot = null;
            let name = null;
            if (typeof a.mode === "number" && Number.isInteger(a.mode)) {
                if (a.mode >= 0 && a.mode <= 6) {
                    slot = a.mode;
                    name = BUILTIN_ROOT_MODES[a.mode];
                }
                else
                    return err("Builtin index must be 0-6; plugins are selected by name");
            }
            else {
                const q = String(a.mode).trim().toLowerCase();
                const bi = BUILTIN_ROOT_MODES.findIndex((n) => n.toLowerCase() === q);
                if (bi >= 0) {
                    slot = bi;
                    name = BUILTIN_ROOT_MODES[bi];
                }
                else {
                    const exact = activeNames.find((n) => n.toLowerCase() === q);
                    if (exact) {
                        slot = 7;
                        name = exact;
                    } // 7+ = plugin slot; loader resolves by LimbModeName
                    else {
                        const subs = [...BUILTIN_ROOT_MODES, ...activeNames].filter((n) => n.toLowerCase().includes(q));
                        if (subs.length === 1) {
                            const hit = subs[0];
                            const b2 = BUILTIN_ROOT_MODES.indexOf(hit);
                            if (b2 >= 0) {
                                slot = b2;
                                name = hit;
                            }
                            else {
                                slot = 7;
                                name = hit;
                            }
                        }
                        else if (subs.length > 1)
                            return err(`Ambiguous: ${subs.join(", ")}`);
                        else
                            return err(`Unknown mode "${a.mode}". Builtins: ${BUILTIN_ROOT_MODES.join(" | ")}. Active plugins: ${activeNames.join(" | ") || "(none)"}`);
                    }
                }
            }
            const { data } = readSaveData();
            data.Reanimator = { ...(data.Reanimator ?? {}) };
            data.Reanimator.LimbMode = slot;
            data.Reanimator.LimbModeName = name;
            if (a.velocity !== undefined) {
                data.Reanimator.LimbVelocity = a.velocity;
            }
            const savePath = writeSaveData(data);
            const snippet = [
                `-- reanim-mcp: RootPart mode -> "${escLuau(name)}"`,
                `pcall(function()`,
                `  local B = _G.ReanimMCP`,
                `  if B and B.SetRootMode then local ok, applied, msg = pcall(B.SetRootMode, "${escLuau(name)}") print("[reanim-mcp] bridge SetRootMode:", ok, applied, msg) if ok and applied then return end end`,
                `end)`,
                `-- fallback: saved to tree.ehehetilde; pick it in Limb Reanimator Config > RootPart Mode or re-run.`,
            ].join("\n");
            return ok({ slot, name, velocity: a.velocity ?? null, saveFile: savePath, snippet }, `RootPart mode picked: ${name} (slot ${slot}). Saved to ${savePath}.\n\nExecutor Luau (live switch, needs bridge v1.0.2 = re-run patched script):\n\`\`\`luau\n${snippet}\n\`\`\``);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
}
//# sourceMappingURL=rootmodes.js.map