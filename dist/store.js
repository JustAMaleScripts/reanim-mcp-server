#!/usr/bin/env node
/**
 * reanim-mcp-server — store helpers
 * Filesystem-backed state for Nooby's uh modded reanimation v1.1.1 (reanim.luau).
 * No Roblox connection needed: everything works on the executor workspace files.
 */
import fs from "node:fs";
import path from "node:path";
export function resolvePaths() {
    const script = process.env.REANIM_SCRIPT ||
        "C:\\Users\\Admin\\AppData\\Local\\Real\\scripts\\reanim.luau";
    const workspace = process.env.REANIM_WORKSPACE ||
        "C:\\Users\\Admin\\AppData\\Local\\Real\\workspace\\UhhhhhhReanim";
    const saveFile = process.env.REANIM_SAVEDATA || path.join(workspace, "tree.ehehetilde");
    const stateFile = process.env.REANIM_STATE || path.join(workspace, "mcp-state.json");
    return {
        script,
        workspace,
        saveFile,
        stateFile,
        builtinDir: path.join(workspace, "BuiltinModules"),
        modulesDir: path.join(workspace, "Modules"),
    };
}
export function readSaveData() {
    const { saveFile } = resolvePaths();
    try {
        const raw = fs.readFileSync(saveFile, "utf-8");
        try {
            return { data: JSON.parse(raw), raw, exists: true, path: saveFile };
        }
        catch {
            return { data: {}, raw, exists: true, path: saveFile };
        }
    }
    catch {
        return { data: {}, raw: null, exists: false, path: saveFile };
    }
}
export function writeSaveData(data) {
    const { saveFile } = resolvePaths();
    fs.mkdirSync(path.dirname(saveFile), { recursive: true });
    fs.writeFileSync(saveFile, JSON.stringify(data), "utf-8");
    return saveFile;
}
export function readState() {
    const { stateFile } = resolvePaths();
    const fallback = { currentDance: null, currentMoveset: null, keybinds: {}, keybindPaging: 0 };
    try {
        const raw = fs.readFileSync(stateFile, "utf-8");
        const j = JSON.parse(raw);
        return { ...fallback, ...j };
    }
    catch {
        return fallback;
    }
}
export function writeState(s) {
    const { stateFile } = resolvePaths();
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(s, null, 2), "utf-8");
    return stateFile;
}
// ---------------------------------------------------------------------------
// Customization defaults (from reanim.luau Util.FX DEFAULT_CFG)
// ---------------------------------------------------------------------------
export const DEFAULT_CFG = {
    TriColorMode: 1, TriColor: "#FFFFFF", TriSize: 1, TriSpin: 1, TriFaceTr: 0.38, TriEdge: 1,
    TriNodes: true, TriFaces: true, TriMusic: true, TriExplode: true,
    IntroTitle: "STEVETHEREALONE", IntroSub: "", IntroMarquee: "", IntroColorMode: 4, IntroColor: "#FFFFFF",
    IntroStars: true, IntroRays: true, IntroScan: true, IntroHud: true, IntroIntensity: 1,
    NotifMode: 1, NotifDuration: 4, NotifTitle: "Nooby's uh modded reanimation v1.1.1", NotifPos: 1, NotifWidth: 300,
    NotifSize: 18, NotifProgress: true, NotifColor: "", NotifSound: false, NotifSpeed: 1,
    UIBgTr: 0, UIBorder: 1, UIRound: 8, UIGlow: true, UIAccent: "",
    AdminTriHidden: false, AdminTriTab: true, AdminTriPos: "",
    AccentMode: 1, HarmonyMode: 1, ColorSpeed: 1, ColorSat: 1, ColorBright: 1,
    UIScale: 1, UIFont: 1, UIAnimSpeed: 1, UIParticles: true, UIGradient: true, UITrail: true,
    RbxIconTheme: true, RbxBarTheme: true, ChatStyle: true, ChatTextSize: 14, ChatBgTr: 0.3, ChatWinW: 1, ChatWinH: 1,
    BubbleDur: 15, BubbleDist: 100, BubbleTail: true,
    MiniControls: 1, LowEnd: false,
    DeltaLogo: true, DeltaMotion: true, DeltaBlur: true, DeltaIntro: true, DeltaSpeed: 1, DeltaSource: "", DeltaEnabled: true,
};
export const ACCENT_MODES = [
    "Theme (follow UI theme)", "Picked color", "Rainbow",
    "Harmony cycle", "Aurora", "Music reactive", "Day / Night",
];
export const HARMONY_MODES = ["Analogous", "Complementary", "Triadic", "Tetradic", "Monochromatic"];
export const TRI_COLOR_MODES = ["Theme", "Picked color", "Rainbow", "Harmony cycle"];
export const NOTIF_MODES = ["Roblox default", "Custom UI", "Both", "Off"];
export const KEYBINDS_PER_PAGE = ["Z", "X", "C", "V", "B", "N", "G", "H", "J", "K", "L", "R", "T", "U", "P"];
function parseOneFile(filePath) {
    let text;
    try {
        text = fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return [];
    }
    const out = [];
    const base = path.basename(filePath);
    // Split into AddModule / table.insert(modules) blocks
    const blocks = text.split(/AddModule\s*\(\s*function|table\.insert\s*\(\s*modules\s*,\s*function/);
    for (let i = 1; i < blocks.length; i++) {
        const b = blocks[i].slice(0, 6000);
        const mt = b.match(/m\s*\.\s*ModuleType\s*=\s*"([^"]+)"/);
        const nm = b.match(/m\s*\.\s*Name\s*=\s*"([^"]+)"/);
        if (mt && nm) {
            const type = mt[1].toUpperCase() === "MOVESET" ? "MOVESET" : "DANCE";
            const desc = b.match(/m\s*\.\s*Description\s*=\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "";
            const internal = b.match(/m\s*\.\s*InternalName\s*=\s*"([^"]+)"/)?.[1] ?? null;
            out.push({ file: filePath, fileBase: base, type: type, name: nm[1], description: desc, internalName: internal, packed: false });
        }
    }
    if (out.length > 0)
        return out;
    // Packed MARKET format: { name = "X", desc = "Y", ... }
    const packedRe = /\{\s*name\s*=\s*"([^"]+)"\s*,\s*desc\s*=\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = packedRe.exec(text)) !== null) {
        out.push({
            file: filePath, fileBase: base, type: "DANCE",
            name: m[1], description: m[2].replace(/\\n/g, "\n"), internalName: null, packed: true,
        });
        if (out.length > 2000)
            break;
    }
    return out;
}
function listLuaFiles(dir) {
    try {
        return fs.readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith(".lua") || f.toLowerCase().endsWith(".lua.txt"))
            .map((f) => path.join(dir, f))
            .sort();
    }
    catch {
        return [];
    }
}
export function getCatalogue() {
    const p = resolvePaths();
    // Keep builtin order stable: v_moveset1, v_moveset2, v_moveset3, v_dance1, v_dance2, d_* (maps are not dances/movesets)
    let builtin = [];
    try {
        const all = fs.readdirSync(p.builtinDir).sort();
        const order = ["v_moveset1.lua", "v_moveset2.lua", "v_moveset3.lua", "v_dance1.lua", "v_dance2.lua"];
        builtin = [
            ...order.map((f) => path.join(p.builtinDir, f)).filter((f) => fs.existsSync(f)),
            ...all.filter((f) => !order.includes(f)).map((f) => path.join(p.builtinDir, f)),
        ];
    }
    catch {
        builtin = [];
    }
    const user = listLuaFiles(p.modulesDir);
    const filesScanned = [...builtin, ...user];
    const movesets = [];
    const dances = [];
    for (const f of filesScanned) {
        for (const e of parseOneFile(f)) {
            if (e.type === "MOVESET")
                movesets.push({ ...e, index: movesets.length + 1 });
            else
                dances.push({ ...e, index: dances.length + 1 });
        }
    }
    return {
        movesets, dances, filesScanned,
        builtinFiles: builtin.map((f) => path.basename(f)),
        userFiles: user.map((f) => path.basename(f)),
    };
}
export function findInList(list, identifier) {
    const q = identifier.trim().toLowerCase();
    const asNum = Number(q);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= list.length) {
        return list[asNum - 1];
    }
    // exact internalName
    let hit = list.find((e) => (e.internalName ?? "").toLowerCase() === q);
    if (hit)
        return hit;
    // exact name
    hit = list.find((e) => e.name.toLowerCase() === q);
    if (hit)
        return hit;
    // substring name
    const subs = list.filter((e) => e.name.toLowerCase().includes(q));
    if (subs.length === 1)
        return subs[0];
    if (subs.length > 1)
        return { ambiguous: subs.slice(0, 10) };
    return null;
}
// ---------------------------------------------------------------------------
// Luau snippet builders
// ---------------------------------------------------------------------------
function escLuau(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
export function snippetSwitchMoveset(name, index) {
    return [
        `-- reanim-mcp: switch moveset to "${escLuau(name)}" (catalogue index ${index})`,
        `-- Live bridge first (patched reanim.luau exposes _G.ReanimMCP), file fallback second.`,
        `pcall(function()`,
        `  local B = _G.ReanimMCP`,
        `  if B and B.SwitchMoveset then local ok, applied, msg = pcall(B.SwitchMoveset, "${escLuau(name)}") print("[reanim-mcp] bridge SwitchMoveset:", ok, applied, msg) if ok and applied then return end end`,
        `  local HS = game:GetService("HttpService")`,
        `  local f = "UhhhhhhReanim/tree.ehehetilde"`,
        `  local ok, raw = pcall(readfile, f)`,
        `  if ok and raw then`,
        `    local ok2, sd = pcall(HS.JSONDecode, HS, raw)`,
        `    if ok2 and type(sd) == "table" then`,
        `      sd.MovesetIndex = ${index}`,
        `      sd.MovesetHash = nil -- let the script re-resolve the hash on load`,
        `      pcall(writefile, f, HS:JSONEncode(sd))`,
        `    end`,
        `  end`,
        `end)`,
        `-- Fallback: click the matching Movesets UI entry (firesignal if available):`,
        `pcall(function()`,
        `  local target = string.lower("${escLuau(name)}")`,
        `  local found = nil`,
        `  for _, gui in ipairs(game:GetService("CoreGui"):GetDescendants()) do`,
        `    if (gui:IsA("TextButton") or gui:IsA("TextLabel")) and type(gui.Text) == "string" then`,
        `      local t = string.lower(gui.Text)`,
        `      if string.find(t, target, 1, true) then found = gui break end`,
        `    end`,
        `  end`,
        `  for _, gui in ipairs(game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui"):GetDescendants()) do`,
        `    if found then break end`,
        `    if (gui:IsA("TextButton") or gui:IsA("TextLabel")) and type(gui.Text) == "string" then`,
        `      local t = string.lower(gui.Text)`,
        `      if string.find(t, target, 1, true) then found = gui break end`,
        `    end`,
        `  end`,
        `  if found then`,
        `    local btn = found:IsA("TextButton") and found or found.Parent and found.Parent:FindFirstChildOfClass("TextButton")`,
        `    if btn and firesignal then firesignal(btn.Activated)`,
        `    elseif btn and btn.Activate then pcall(function() btn:Activate() end) end`,
        `  end`,
        `end)`,
        `print("[reanim-mcp] moveset pick saved: ${escLuau(name)} (#${index}). Re-run reanim.luau or press the Movesets entry if it did not switch live.")`,
    ].join("\n");
}
export function snippetSwitchDance(name) {
    return [
        `-- reanim-mcp: switch dance to "${escLuau(name)}"`,
        `-- Live bridge first (_G.ReanimMCP.SwitchDance), UI click fallback second.`,
        `pcall(function()`,
        `  local B = _G.ReanimMCP`,
        `  if B and B.SwitchDance then local ok, applied, msg = pcall(B.SwitchDance, "${escLuau(name)}") print("[reanim-mcp] bridge SwitchDance:", ok, applied, msg) if ok and applied then return end end`,
        `end)`,
        `pcall(function()`,
        `  local target = string.lower("${escLuau(name)}")`,
        `  local found = nil`,
        `  local function scan(parent)`,
        `    for _, gui in ipairs(parent:GetDescendants()) do`,
        `      if (gui:IsA("TextButton") or gui:IsA("TextLabel")) and type(gui.Text) == "string" then`,
        `        if string.find(string.lower(gui.Text), target, 1, true) then return gui end`,
        `      end`,
        `    end`,
        `    return nil`,
        `  end`,
        `  found = scan(game:GetService("CoreGui"))`,
        `  if not found then found = scan(game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")) end`,
        `  if found then`,
        `    local btn = found:IsA("TextButton") and found or found.Parent and found.Parent:FindFirstChildOfClass("TextButton")`,
        `    if btn and firesignal then firesignal(btn.Activated)`,
        `    elseif btn and btn.Activate then pcall(function() btn:Activate() end) end`,
        `  else`,
        `    warn("[reanim-mcp] dance UI entry not found - open Dances page and pick ${escLuau(name)} (or bind it to Z/X/C/V/B/N/G/H/J/K/L/R/T/U/P).")`,
        `  end`,
        `end)`,
    ].join("\n");
}
export function snippetStopDance() {
    return [
        `-- reanim-mcp: stop current dance`,
        `-- Live bridge first; UI Stop button fallback second.`,
        `pcall(function() local B = _G.ReanimMCP if B and B.StopDance then pcall(B.StopDance) return end end)`,
        `pcall(function()`,
        `  local lp = game:GetService("Players").LocalPlayer`,
        `  local pg = lp and lp:FindFirstChildOfClass("PlayerGui")`,
        `  local cg = game:GetService("CoreGui")`,
        `  local function clickStop(parent)`,
        `    for _, gui in ipairs(parent:GetDescendants()) do`,
        `      if gui:IsA("TextButton") and (gui.Text == "Stop" or string.lower(gui.Text):find("stop")) then`,
        `        if firesignal then firesignal(gui.Activated) return true end`,
        `      end`,
        `    end`,
        `    return false`,
        `  end`,
        `  if not clickStop(cg) and pg then clickStop(pg) end`,
        `end)`,
        `print("[reanim-mcp] if still dancing, press your active dance keybind again (toggles off).")`,
    ].join("\n");
}
export function snippetApplyCustom(jsonPatch) {
    const hs = JSON.stringify(jsonPatch);
    const hsLit = `[[${hs.replaceAll("]]", "] ]")}]]`;
    return [
        `-- reanim-mcp: apply UI customization ${escLuau(hs)}`,
        `-- Live bridge first (_G.ReanimMCP.SetTheme), file fallback second.`,
        `pcall(function()`,
        `  local B = _G.ReanimMCP`,
        `  if B and B.SetTheme then local ok, applied = pcall(B.SetTheme, game:GetService("HttpService"):JSONDecode(${hsLit})) print("[reanim-mcp] bridge SetTheme:", ok, applied) if ok and applied then return end end`,
        `end)`,
        `pcall(function()`,
        `  local HS = game:GetService("HttpService")`,
        `  local patch = HS:JSONDecode([[${hs.replaceAll("]]", "] ]")}]])`,
        `  local f = "UhhhhhhReanim/tree.ehehetilde"`,
        `  local ok, raw = pcall(readfile, f)`,
        `  local sd = {} `,
        `  if ok and raw then local ok2, d = pcall(HS.JSONDecode, HS, raw) if ok2 and type(d)=="table" then sd = d end end`,
        `  sd.Custom = type(sd.Custom)=="table" and sd.Custom or {}`,
        `  for k, v in pairs(patch) do sd.Custom[k] = v end`,
        `  pcall(writefile, f, HS:JSONEncode(sd))`,
        `end)`,
        `print("[reanim-mcp] customization saved. Re-open the Customization page or re-run the script for full effect.")`,
    ].join("\n");
}
//# sourceMappingURL=store.js.map