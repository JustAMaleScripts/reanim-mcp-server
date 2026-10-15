#!/usr/bin/env node
export interface Paths {
    script: string;
    workspace: string;
    saveFile: string;
    stateFile: string;
    builtinDir: string;
    modulesDir: string;
}
export declare function resolvePaths(): Paths;
export type SaveData = Record<string, any>;
export declare function readSaveData(): {
    data: SaveData;
    raw: string | null;
    exists: boolean;
    path: string;
};
export declare function writeSaveData(data: SaveData): string;
export interface McpState {
    currentDance: {
        name: string;
        file: string;
        index: number;
        internalName?: string;
        updatedAt: string;
    } | null;
    currentMoveset: {
        name: string;
        file: string;
        index: number;
        internalName?: string;
        updatedAt: string;
    } | null;
    keybinds: Record<string, string>;
    keybindPaging: number;
}
export declare function readState(): McpState;
export declare function writeState(s: McpState): string;
export declare const DEFAULT_CFG: Record<string, any>;
export declare const ACCENT_MODES: string[];
export declare const HARMONY_MODES: string[];
export declare const TRI_COLOR_MODES: string[];
export declare const NOTIF_MODES: string[];
export declare const KEYBINDS_PER_PAGE: string[];
export interface ParsedEntry {
    file: string;
    fileBase: string;
    type: "MOVESET" | "DANCE";
    name: string;
    description: string;
    internalName: string | null;
    packed: boolean;
}
export interface Catalogue {
    movesets: (ParsedEntry & {
        index: number;
    })[];
    dances: (ParsedEntry & {
        index: number;
    })[];
    filesScanned: string[];
    builtinFiles: string[];
    userFiles: string[];
}
export declare function getCatalogue(): Catalogue;
export declare function findInList(list: (ParsedEntry & {
    index: number;
})[], identifier: string): any;
export declare function snippetSwitchMoveset(name: string, index: number): string;
export declare function snippetSwitchDance(name: string): string;
export declare function snippetStopDance(): string;
export declare function snippetApplyCustom(jsonPatch: Record<string, any>): string;
//# sourceMappingURL=store.d.ts.map