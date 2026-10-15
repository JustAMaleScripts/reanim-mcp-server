#!/usr/bin/env node
/**
 * reanim-mcp-server — MCP server for Nooby's uh modded reanimation (reanim.luau).
 * 26 tools: dances, movesets, keybinds, UI theme, customization, performance,
 * modules, reanimator settings, search + Luau snippet generation.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerTools } from "./tools.js";
import { registerMakerTools } from "./maker.js";
import { registerRootTools } from "./rootmodes.js";

const server = new McpServer({ name: "reanim-mcp-server", version: "1.2.0" });
registerTools(server);
registerMakerTools(server);
registerRootTools(server);

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("reanim-mcp-server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", server: "reanim-mcp-server", version: "1.0.0" });
  });
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const port = parseInt(process.env.PORT || "3001");
  app.listen(port, () => console.error(`reanim-mcp-server on http://localhost:${port}/mcp`));
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
reanim-mcp-server v1.0.0 — Nooby's uh modded reanimation MCP

TOOLS (26): reanim_status, reanim_list_movesets, reanim_list_dances,
reanim_check_movesets, reanim_check_dances, reanim_get_current_moveset,
reanim_switch_moveset, reanim_get_current_dance, reanim_switch_dance,
reanim_stop_dance, reanim_list_dance_keybinds, reanim_set_dance_keybind,
reanim_get_ui_theme, reanim_set_ui_theme, reanim_get_customization,
reanim_set_customization, reanim_reset_customization, reanim_get_performance,
reanim_set_low_end_mode, reanim_list_modules, reanim_get_module_info,
reanim_search_features, reanim_get_reanimator_settings,
reanim_set_reanimator_settings, reanim_generate_snippet, reanim_get_savedata

ENV:
  REANIM_SCRIPT    default C:\\Users\\Admin\\AppData\\Local\\Real\\scripts\\reanim.luau
  REANIM_WORKSPACE default C:\\Users\\Admin\\AppData\\Local\\Real\\workspace\\UhhhhhhReanim
  REANIM_SAVEDATA  default <workspace>/tree.ehehetilde
  REANIM_STATE     default <workspace>/mcp-state.json
  TRANSPORT        stdio (default) | http
  PORT             http port (default 3001)
`);
  process.exit(0);
}
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log("reanim-mcp-server v1.0.0");
  process.exit(0);
}

const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") runHTTP().catch((e) => { console.error(e); process.exit(1); });
else runStdio().catch((e) => { console.error(e); process.exit(1); });
