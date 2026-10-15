import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { ACCENT_MODES, DEFAULT_CFG, HARMONY_MODES, KEYBINDS_PER_PAGE, NOTIF_MODES, TRI_COLOR_MODES, findInList, getCatalogue, readSaveData, readState, resolvePaths, snippetApplyCustom, snippetStopDance, snippetSwitchDance, snippetSwitchMoveset, writeSaveData, writeState, } from "./store.js";
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
const Identifier = z.string().min(1).describe("Name substring, exact name, InternalName, or 1-based index");
export function registerTools(server) {
    // 1 — status
    server.registerTool("reanim_status", {
        title: "Reanim status",
        description: "Check reanim.luau script, workspace, SaveData and module counts. Use first to verify setup.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const p = resolvePaths();
            const scriptExists = fs.existsSync(p.script);
            const scriptBytes = scriptExists ? fs.statSync(p.script).size : 0;
            const { data, exists } = readSaveData();
            const cat = getCatalogue();
            const st = readState();
            return ok({
                script: p.script, scriptExists, scriptBytes,
                workspace: p.workspace, saveFile: p.saveFile, saveExists: exists,
                movesets: cat.movesets.length, dances: cat.dances.length,
                builtinFiles: cat.builtinFiles, userFiles: cat.userFiles,
                savedMovesetIndex: data.MovesetIndex ?? null,
                mcpDance: st.currentDance, mcpMoveset: st.currentMoveset,
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 2 — list movesets
    server.registerTool("reanim_list_movesets", {
        title: "List movesets",
        description: "List all parsed movesets (builtin v_moveset1-3 + Modules/*.lua). Returns index, name, InternalName, file, description.",
        inputSchema: z.object({ query: z.string().optional().describe("Optional case-insensitive filter on name/InternalName/file") }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const cat = getCatalogue();
            let list = cat.movesets;
            if (a.query) {
                const q = a.query.toLowerCase();
                list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.internalName ?? "").toLowerCase().includes(q) || e.fileBase.toLowerCase().includes(q));
            }
            return ok({ count: list.length, movesets: list.map((e) => ({ index: e.index, name: e.name, internalName: e.internalName, file: e.fileBase, description: e.description.split("\n")[0] ?? "" })) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 3 — list dances
    server.registerTool("reanim_list_dances", {
        title: "List dances",
        description: "List all parsed dances (builtin v_dance1-2 + Modules/*.lua incl. packed MARKET files). Returns index, name, file, description.",
        inputSchema: z.object({ query: z.string().optional().describe("Optional filter"), limit: z.number().int().min(1).max(2000).default(200).describe("Max entries") }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const cat = getCatalogue();
            let list = cat.dances;
            if (a.query) {
                const q = a.query.toLowerCase();
                list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.internalName ?? "").toLowerCase().includes(q) || e.fileBase.toLowerCase().includes(q));
            }
            const slice = list.slice(0, a.limit);
            return ok({
                total: list.length, returned: slice.length,
                dances: slice.map((e) => ({ index: e.index, name: e.name, internalName: e.internalName, file: e.fileBase, packed: e.packed, description: (e.description.split("\n")[0] ?? "").slice(0, 160) })),
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 4 — check movesets
    server.registerTool("reanim_check_movesets", {
        title: "Check movesets",
        description: "Validate moveset catalogue: counts per file, entries missing Name/Type, saved MovesetIndex in range, ContentHash coverage.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const cat = getCatalogue();
            const { data } = readSaveData();
            const perFile = {};
            for (const m of cat.movesets)
                perFile[m.fileBase] = (perFile[m.fileBase] ?? 0) + 1;
            const idx = data.MovesetIndex;
            const issues = [];
            if (typeof idx === "number" && (idx < 1 || idx > cat.movesets.length))
                issues.push(`Saved MovesetIndex ${idx} out of range 1..${cat.movesets.length}`);
            if (cat.movesets.length === 0)
                issues.push("No movesets parsed — check BuiltinModules/Modules paths");
            const hash = data.ContentHash ?? {};
            const missingHash = cat.builtinFiles.filter((f) => !(f in hash));
            return ok({ total: cat.movesets.length, perFile, savedIndex: idx ?? null, savedHash: data.MovesetHash ?? null, missingContentHash: missingHash, issues });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 5 — check dances
    server.registerTool("reanim_check_dances", {
        title: "Check dances",
        description: "Validate dance catalogue: counts per file, packed MARKET entries, duplicate names, keybind coverage.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const cat = getCatalogue();
            const perFile = {};
            for (const d of cat.dances)
                perFile[d.fileBase] = (perFile[d.fileBase] ?? 0) + 1;
            const seen = {};
            for (const d of cat.dances)
                seen[d.name.toLowerCase()] = (seen[d.name.toLowerCase()] ?? 0) + 1;
            const dups = Object.entries(seen).filter(([, n]) => n > 1).slice(0, 20).map(([k, n]) => ({ name: k, count: n }));
            const packed = cat.dances.filter((d) => d.packed).length;
            const issues = [];
            if (cat.dances.length === 0)
                issues.push("No dances parsed");
            return ok({ total: cat.dances.length, packed, perFile, duplicates: dups, keybindSlots: KEYBINDS_PER_PAGE.length, issues });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 6 — get current moveset
    server.registerTool("reanim_get_current_moveset", {
        title: "Get current moveset",
        description: "Show saved MovesetIndex/MovesetHash from tree.ehehetilde plus last MCP switch_moveset pick and resolved name.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const cat = getCatalogue();
            const st = readState();
            const idx = data.MovesetIndex;
            const resolved = typeof idx === "number" && idx >= 1 && idx <= cat.movesets.length ? cat.movesets[idx - 1] : null;
            return ok({ savedIndex: idx ?? null, savedHash: data.MovesetHash ?? null, resolved: resolved ? { index: resolved.index, name: resolved.name, internalName: resolved.internalName, file: resolved.fileBase } : null, mcpPick: st.currentMoveset });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 7 — switch moveset
    server.registerTool("reanim_switch_moveset", {
        title: "Switch moveset",
        description: "Persist a moveset pick (SaveData.MovesetIndex + MCP state) and return executor-ready Luau that clicks the Movesets UI entry live. Identifier = name substring, InternalName, or 1-based index from reanim_list_movesets.",
        inputSchema: z.object({ moveset: Identifier }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const cat = getCatalogue();
            const hit = findInList(cat.movesets, a.moveset);
            if (!hit)
                return err(`Moveset "${a.moveset}" not found. Use reanim_list_movesets to see options.`);
            if (hit.ambiguous)
                return err(`Ambiguous: matches ${hit.ambiguous.map((x) => x.name).join(", ")}. Be more specific or use index.`);
            const { data } = readSaveData();
            data.MovesetIndex = hit.index;
            data.MovesetHash = null;
            const savePath = writeSaveData(data);
            const st = readState();
            st.currentMoveset = { name: hit.name, file: hit.fileBase, index: hit.index, internalName: hit.internalName ?? undefined, updatedAt: new Date().toISOString() };
            writeState(st);
            const snippet = snippetSwitchMoveset(hit.name, hit.index);
            return ok({ picked: { index: hit.index, name: hit.name, internalName: hit.internalName, file: hit.fileBase }, saveFile: savePath, snippet }, `Moveset picked: #${hit.index} ${hit.name} (${hit.fileBase}). SaveData updated at ${savePath}.\n\nExecutor Luau (run in executor; clicks Movesets UI live, falls back to next-launch pick):\n\`\`\`luau\n${snippet}\n\`\`\``);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 8 — get current dance
    server.registerTool("reanim_get_current_dance", {
        title: "Get current dance",
        description: "Show last MCP switch_dance pick (dances are runtime-only; the script persists only MovesetIndex). Also reports keybind paging.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const st = readState();
            return ok({ currentDance: st.currentDance, keybinds: st.keybinds, keybindPaging: st.keybindPaging });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 9 — switch dance
    server.registerTool("reanim_switch_dance", {
        title: "Switch dance",
        description: "Record a dance pick in MCP state and return executor-ready Luau that clicks the matching Dances UI entry. Identifier = name substring, InternalName, or 1-based index from reanim_list_dances.",
        inputSchema: z.object({ dance: Identifier }).strict(),
        annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const cat = getCatalogue();
            const hit = findInList(cat.dances, a.dance);
            if (!hit)
                return err(`Dance "${a.dance}" not found. Use reanim_list_dances.`);
            if (hit.ambiguous)
                return err(`Ambiguous: ${hit.ambiguous.map((x) => `#${x.index} ${x.name}`).join("; ")}. Refine query or use index.`);
            const st = readState();
            st.currentDance = { name: hit.name, file: hit.fileBase, index: hit.index, internalName: hit.internalName ?? undefined, updatedAt: new Date().toISOString() };
            writeState(st);
            const snippet = snippetSwitchDance(hit.name);
            return ok({ picked: { index: hit.index, name: hit.name, file: hit.fileBase }, snippet }, `Dance picked: #${hit.index} ${hit.name} (${hit.fileBase}).\n\nExecutor Luau:\n\`\`\`luau\n${snippet}\n\`\`\`\nIf it does not start live, open the Dances page and tap "${hit.name}".`);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 10 — stop dance
    server.registerTool("reanim_stop_dance", {
        title: "Stop dance",
        description: "Clear MCP current dance and return Luau that attempts to stop dancing (UI Stop button; otherwise re-press active keybind).",
        inputSchema: NoArgs, annotations: { readOnlyHint: false, openWorldHint: false },
    }, async () => {
        try {
            const st = readState();
            st.currentDance = null;
            writeState(st);
            return ok({ stopped: true, snippet: snippetStopDance() }, `Dance state cleared.\n\nExecutor Luau:\n\`\`\`luau\n${snippetStopDance()}\n\`\`\``);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 11 — list dance keybinds
    server.registerTool("reanim_list_dance_keybinds", {
        title: "List dance keybinds",
        description: "Show the 15 dance keybind slots (Z X C V B N G H J K L R T U P), current page, and MCP-assigned dances.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const st = readState();
            return ok({ slots: KEYBINDS_PER_PAGE, paging: st.keybindPaging, assignments: st.keybinds, hint: "In-script: M pages through DanceableDances; keybinds toggle CurrentDance (HandleKeybind)." });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 12 — set dance keybind
    server.registerTool("reanim_set_dance_keybind", {
        title: "Set dance keybind",
        description: "Bind a dance to a key slot (Z/X/C/V/B/N/G/H/J/K/L/R/T/U/P) in MCP state and return Luau hint snippet.",
        inputSchema: z.object({
            key: z.string().min(1).max(2).describe("One of Z X C V B N G H J K L R T U P"),
            dance: Identifier,
        }).strict(), annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const key = a.key.toUpperCase();
            if (!KEYBINDS_PER_PAGE.includes(key))
                return err(`Key must be one of ${KEYBINDS_PER_PAGE.join(" ")}`);
            const cat = getCatalogue();
            const hit = findInList(cat.dances, a.dance);
            if (!hit || hit.ambiguous)
                return err(!hit ? "Dance not found" : "Ambiguous dance — refine query");
            const st = readState();
            st.keybinds[key] = hit.name;
            writeState(st);
            const snippet = `-- reanim-mcp: keybind ${key} -> "${hit.name.replace(/"/g, "'")}"\n-- Open "Dance Keybinds" page, page ${st.keybindPaging}, and tap the entry for "${hit.name.replace(/"/g, "'")}" to bind it to ${key}.\nprint("[reanim-mcp] bind ${key} = ${hit.name.replace(/"/g, "'")}")`;
            return ok({ key, dance: hit.name, snippet });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 13 — get UI theme
    server.registerTool("reanim_get_ui_theme", {
        title: "Get UI theme",
        description: "Read theme-related Custom keys: AccentMode, HarmonyMode, UIAccent, ColorSpeed/Sat/Bright, TriColorMode/TriColor, IntroColorMode/IntroColor, UIGlow/Gradient, etc.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const c = (data.Custom ?? {});
            return ok({
                AccentMode: c.AccentMode ?? 1, AccentModeName: ACCENT_MODES[(c.AccentMode ?? 1) - 1] ?? "?",
                HarmonyMode: c.HarmonyMode ?? 1, HarmonyModeName: HARMONY_MODES[(c.HarmonyMode ?? 1) - 1] ?? "?",
                UIAccent: c.UIAccent ?? "", ColorSpeed: c.ColorSpeed ?? 1, ColorSat: c.ColorSat ?? 1, ColorBright: c.ColorBright ?? 1,
                TriColorMode: c.TriColorMode ?? 1, TriColorModeName: TRI_COLOR_MODES[(c.TriColorMode ?? 1) - 1] ?? "?",
                TriColor: c.TriColor ?? "#FFFFFF",
                IntroColorMode: c.IntroColorMode ?? 4, IntroColor: c.IntroColor ?? "#FFFFFF",
                UIGlow: c.UIGlow ?? true, UIGradient: c.UIGradient ?? true, UIParticles: c.UIParticles ?? true, UITrail: c.UITrail ?? true,
                accentModes: ACCENT_MODES, harmonyModes: HARMONY_MODES, triModes: TRI_COLOR_MODES,
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 14 — set UI theme
    server.registerTool("reanim_set_ui_theme", {
        title: "Set UI theme",
        description: "Change UI theme: AccentMode 1-7, HarmonyMode 1-5, UIAccent hex, ColorSpeed/Sat/Bright, TriColorMode/TriColor, IntroColorMode/IntroColor. Persists to SaveData.Custom and returns apply snippet.",
        inputSchema: z.object({
            AccentMode: z.number().int().min(1).max(7).optional().describe("1 Theme,2 Picked,3 Rainbow,4 Harmony,5 Aurora,6 Music,7 Day/Night"),
            HarmonyMode: z.number().int().min(1).max(5).optional(),
            UIAccent: z.string().optional().describe("Hex like #FF00AA (used when AccentMode=2) or empty for theme"),
            ColorSpeed: z.number().min(0.1).max(5).optional(),
            ColorSat: z.number().min(0).max(2).optional(),
            ColorBright: z.number().min(0).max(2).optional(),
            TriColorMode: z.number().int().min(1).max(4).optional(),
            TriColor: z.string().optional().describe("Hex for triangle when TriColorMode=2"),
            IntroColorMode: z.number().int().min(1).max(4).optional(),
            IntroColor: z.string().optional(),
        }).strict(), annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const patch = {};
            for (const [k, v] of Object.entries(a))
                if (v !== undefined)
                    patch[k] = v;
            if (Object.keys(patch).length === 0)
                return err("No theme fields provided");
            if (patch.UIAccent !== undefined && patch.UIAccent !== "" && !/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(patch.UIAccent))
                return err("UIAccent must be hex like #FF00AA or empty");
            const { data } = readSaveData();
            data.Custom = { ...(data.Custom ?? {}), ...patch };
            const savePath = writeSaveData(data);
            return ok({ updated: patch, saveFile: savePath, snippet: snippetApplyCustom(patch) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 15 — get customization
    server.registerTool("reanim_get_customization", {
        title: "Get customization",
        description: "Return full SaveData.Custom table (triangle/intro/notification/UI/scale/font/particles/chat/delta options) with defaults filled.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const merged = { ...DEFAULT_CFG, ...(data.Custom ?? {}) };
            return ok({ custom: merged, notifModes: NOTIF_MODES });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 16 — set customization
    server.registerTool("reanim_set_customization", {
        title: "Set customization",
        description: "Set any SaveData.Custom key (TriSize, TriSpin, IntroTitle, NotifMode, UIScale, UIFont, UIAnimSpeed, UIParticles, LowEnd, ...). Unknown keys are rejected.",
        inputSchema: z.object({
            key: z.string().min(1).describe("Custom key, e.g. TriSize, IntroTitle, NotifMode, UIScale, UIFont"),
            value: z.union([z.string(), z.number(), z.boolean()]).describe("New value"),
        }).strict(), annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            if (!(a.key in DEFAULT_CFG) && a.key !== "MiniData")
                return err(`Unknown Custom key "${a.key}". Valid: ${Object.keys(DEFAULT_CFG).join(", ")}`);
            const { data } = readSaveData();
            data.Custom = { ...(data.Custom ?? {}), [a.key]: a.value };
            const savePath = writeSaveData(data);
            return ok({ key: a.key, value: a.value, saveFile: savePath, snippet: snippetApplyCustom({ [a.key]: a.value }) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 17 — reset customization
    server.registerTool("reanim_reset_customization", {
        title: "Reset customization",
        description: "Reset SaveData.Custom to script defaults (keeps LowEnd performance flag).",
        inputSchema: NoArgs, annotations: { readOnlyHint: false, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const keepLow = (data.Custom ?? {}).LowEnd ?? false;
            data.Custom = { ...DEFAULT_CFG, LowEnd: keepLow };
            const savePath = writeSaveData(data);
            return ok({ reset: true, keptLowEnd: keepLow, saveFile: savePath });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 18 — performance
    server.registerTool("reanim_get_performance", {
        title: "Get performance settings",
        description: "Read LowEnd UI mode, FXBlur, FXSounds, FXTransitions, FXAmbient and related perf flags.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            const c = data.Custom ?? {};
            return ok({
                LowEnd: c.LowEnd ?? false, FXBlur: data.FXBlur ?? null, FXSounds: data.FXSounds ?? null,
                FXTransitions: data.FXTransitions ?? null, FXAmbient: data.FXAmbient ?? null,
                note: "LowEnd ON: 8-part triangle @30fps, no intro/blur/transitions/glow/particles/sheen/trail, minigames off.",
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 19 — low end mode
    server.registerTool("reanim_set_low_end_mode", {
        title: "Set low end mode",
        description: "Toggle LowEnd UI Mode (Main page > Performance). ON = basic UI + simplified triangle; OFF restores your settings.",
        inputSchema: z.object({ enabled: z.boolean().describe("true = ON, false = OFF") }).strict(),
        annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const { data } = readSaveData();
            data.Custom = { ...(data.Custom ?? {}), LowEnd: a.enabled };
            const savePath = writeSaveData(data);
            return ok({ LowEnd: a.enabled, saveFile: savePath, snippet: snippetApplyCustom({ LowEnd: a.enabled }) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 20 — list modules
    server.registerTool("reanim_list_modules", {
        title: "List modules",
        description: "List .lua module files in BuiltinModules, Modules, Plugins, FlingMethods, Minigames, AdminPlugins, Muzik.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const p = resolvePaths();
            const dirs = ["BuiltinModules", "Modules", "Plugins", "FlingMethods", "Minigames", "AdminPlugins", "Muzik", "Assets"];
            const out = {};
            for (const d of dirs) {
                try {
                    out[d] = fs.readdirSync(path.join(p.workspace, d)).sort();
                }
                catch {
                    out[d] = [];
                }
            }
            return ok(out);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 21 — module info
    server.registerTool("reanim_get_module_info", {
        title: "Get module info",
        description: "Parse one module file and return its AddModule entries (type/name/description/InternalName) plus size. Accepts filename or full path.",
        inputSchema: z.object({ file: z.string().min(1).describe("e.g. v_moveset1.lua or MARKET_Pipis.allinone.lua") }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const p = resolvePaths();
            const cand = [a.file, path.join(p.builtinDir, a.file), path.join(p.modulesDir, a.file)];
            const hit = cand.find((f) => fs.existsSync(f));
            if (!hit)
                return err(`File not found: ${a.file}`);
            const text = fs.readFileSync(hit, "utf-8");
            const cat = getCatalogue();
            const normHit = path.resolve(hit).toLowerCase();
            const entries = [...cat.movesets, ...cat.dances].filter((e) => path.resolve(e.file).toLowerCase() === normHit || e.fileBase.toLowerCase() === path.basename(hit).toLowerCase());
            return ok({ file: hit, bytes: text.length, entries: entries.map((e) => ({ type: e.type, name: e.name, internalName: e.internalName, description: e.description.slice(0, 300) })) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 22 — search features
    server.registerTool("reanim_search_features", {
        title: "Search features",
        description: "Case-insensitive search over reanim.luau (~14MB) mimicking the V16 search bar. Returns up to N matching lines with line numbers.",
        inputSchema: z.object({
            query: z.string().min(1).describe("Search text, e.g. Fling Method, WalkSpeed, Server Hop, Anti Lag"),
            limit: z.number().int().min(1).max(50).default(15),
        }).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const p = resolvePaths();
            const text = fs.readFileSync(p.script, "utf-8");
            const lines = text.split("\n");
            const q = a.query.toLowerCase();
            const hits = [];
            for (let i = 0; i < lines.length && hits.length < a.limit; i++) {
                if (lines[i].toLowerCase().includes(q))
                    hits.push({ line: i + 1, text: lines[i].slice(0, 300) });
            }
            return ok({ query: a.query, hits, totalLines: lines.length });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 23 — reanimator settings
    server.registerTool("reanim_get_reanimator_settings", {
        title: "Get reanimator settings",
        description: "Read SelectedReanimator, Reanimator, FlingMethod, CharMove (Walk/Fly speed), ServerReanim, ClickFling, PhysicsRepRootPartFling.",
        inputSchema: NoArgs, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
        try {
            const { data } = readSaveData();
            return ok({
                SelectedReanimator: data.SelectedReanimator ?? null, Reanimator: data.Reanimator ?? null,
                FlingMethod: data.FlingMethod ?? null, CharMove: data.CharMove ?? null,
                ClickFlingEnabled: data.ClickFlingEnabled ?? null, PhysicsRepRootPartFling: data.PhysicsRepRootPartFling ?? null,
                ServerReanim: data.ServerReanim ?? null, NoSeatSitEnabled: data.NoSeatSitEnabled ?? null,
            });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 24 — set reanimator settings
    server.registerTool("reanim_set_reanimator_settings", {
        title: "Set reanimator settings",
        description: "Update reanimator/movement/fling SaveData keys. Only provided fields change.",
        inputSchema: z.object({
            SelectedReanimator: z.number().int().min(1).max(2).optional().describe("1 Limb, 2 Hats"),
            FlingMethod: z.number().int().optional(),
            WalkSpeed: z.number().min(0).max(500).optional(),
            FlySpeed: z.number().min(0).max(500).optional(),
            ClickFlingEnabled: z.boolean().optional(),
        }).strict(), annotations: { readOnlyHint: false, openWorldHint: false },
    }, async (a) => {
        try {
            const { data } = readSaveData();
            if (a.SelectedReanimator !== undefined)
                data.SelectedReanimator = a.SelectedReanimator;
            if (a.FlingMethod !== undefined)
                data.FlingMethod = a.FlingMethod;
            if (a.ClickFlingEnabled !== undefined)
                data.ClickFlingEnabled = a.ClickFlingEnabled;
            if (a.WalkSpeed !== undefined || a.FlySpeed !== undefined) {
                data.CharMove = { ...(data.CharMove ?? {}) };
                if (a.WalkSpeed !== undefined)
                    data.CharMove.WalkSpeed = a.WalkSpeed;
                if (a.FlySpeed !== undefined)
                    data.CharMove.FlySpeed = a.FlySpeed;
            }
            const savePath = writeSaveData(data);
            return ok({ updated: a, saveFile: savePath });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 25 — generate snippet
    server.registerTool("reanim_generate_snippet", {
        title: "Generate Luau snippet",
        description: "Build an executor-ready Luau snippet for a dance/moveset/theme/custom action without changing files.",
        inputSchema: z.object({
            kind: z.enum(["moveset", "dance", "stop_dance", "custom"]).describe("Snippet kind"),
            name: z.string().optional().describe("Moveset/dance name (for moveset/dance kinds)"),
            custom: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Custom patch (for custom kind)"),
        }).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            if (a.kind === "moveset") {
                const cat = getCatalogue();
                const hit = a.name ? findInList(cat.movesets, a.name) : null;
                const nm = hit && !hit.ambiguous ? hit.name : (a.name ?? "MovesetName");
                const ix = hit && !hit.ambiguous ? hit.index : 1;
                return ok({ snippet: snippetSwitchMoveset(nm, ix) });
            }
            if (a.kind === "dance")
                return ok({ snippet: snippetSwitchDance(a.name ?? "DanceName") });
            if (a.kind === "stop_dance")
                return ok({ snippet: snippetStopDance() });
            return ok({ snippet: snippetApplyCustom(a.custom ?? { AccentMode: 1 }) });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
    // 26 — raw savedata
    server.registerTool("reanim_get_savedata", {
        title: "Get SaveData",
        description: "Return raw SaveData keys (top-level summary + full Custom). Useful for debugging; prefer the typed getters for edits.",
        inputSchema: z.object({ includeModuleConfigs: z.boolean().default(false).describe("Include huge ModuleConfigs map") }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
    }, async (a) => {
        try {
            const { data, path } = readSaveData();
            const copy = { ...data };
            if (!a.includeModuleConfigs) {
                copy.ModuleConfigs = `(${Object.keys(data.ModuleConfigs ?? {}).length} entries hidden)`;
                copy.ContentHash = `(${Object.keys(data.ContentHash ?? {}).length} entries hidden)`;
            }
            return ok({ path, savedata: copy });
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    });
}
//# sourceMappingURL=tools.js.map