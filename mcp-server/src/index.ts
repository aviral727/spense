#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const execAsync = promisify(exec);

// Project root is one level up from mcp-server/
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../../");

// ── Safety: restrict file access to inside the project ──────────────────────
function safePath(filePath: string): string {
    const abs = resolve(PROJECT_ROOT, filePath.replace(/^\//, ""));
    if (!abs.startsWith(PROJECT_ROOT)) {
        throw new McpError(ErrorCode.InvalidParams, "Path escapes project root — not allowed.");
    }
    return abs;
}

// ── Shell helper (logs nothing to stdout, keeping stdio clean for MCP) ───────
async function sh(cmd: string, cwd = PROJECT_ROOT, timeoutMs = 360_000): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: timeoutMs });
        return [stdout, stderr ? `[stderr] ${stderr}` : ""].filter(Boolean).join("\n").trim();
    } catch (e: any) {
        return `ERROR: ${e.message}\n${e.stderr ?? ""}`.trim();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
const server = new Server(
    { name: "spense-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "get_context",
            description:
                "Returns CONTEXT.md — the definitive project context document. " +
                "Always call this at the start of a new session before doing anything else.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "read_file",
            description: "Read any source file inside the Spense project.",
            inputSchema: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Relative path from project root, e.g. 'app/(tabs)/index.tsx' or 'android/app/build.gradle'",
                    },
                },
                required: ["path"],
            },
        },
        {
            name: "list_files",
            description: "List project files (excludes node_modules, .git, android build dirs).",
            inputSchema: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Relative subdirectory to list (defaults to project root).",
                        default: "",
                    },
                    depth: {
                        type: "number",
                        description: "Max depth (default 3).",
                        default: 3,
                    },
                },
            },
        },
        {
            name: "git_log",
            description: "Get recent git commits.",
            inputSchema: {
                type: "object",
                properties: {
                    count: { type: "number", description: "Number of commits to show (default 10).", default: 10 },
                },
            },
        },
        {
            name: "git_status",
            description: "Get current git status and a diff summary.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "get_version",
            description: "Get the current versionCode and versionName from android/app/build.gradle.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "bump_version",
            description: "Update versionCode and versionName in android/app/build.gradle before a release.",
            inputSchema: {
                type: "object",
                properties: {
                    versionCode: { type: "number", description: "New integer version code (must be higher than current)." },
                    versionName: { type: "string", description: "New semantic version string, e.g. '1.2.0'." },
                },
                required: ["versionCode", "versionName"],
            },
        },
        {
            name: "build_release_aab",
            description:
                "Run './gradlew bundleRelease' to produce a signed AAB for Play Store upload. Takes ~3 minutes.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "build_release_apk",
            description:
                "Run './gradlew assembleRelease' to produce a signed APK for direct sideload/testing. Takes ~3 minutes.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "get_build_artifacts",
            description: "Check whether the latest APK and AAB builds exist and return their sizes and timestamps.",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "git_commit_push",
            description: "Stage all changes, create a commit, and push to origin/main.",
            inputSchema: {
                type: "object",
                properties: {
                    message: { type: "string", description: "Commit message." },
                },
                required: ["message"],
            },
        },
    ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    const text = (content: string) => ({ content: [{ type: "text" as const, text: content }] });

    switch (name) {
        // ── Context ───────────────────────────────────────────────────────────
        case "get_context": {
            const contextPath = join(PROJECT_ROOT, "CONTEXT.md");
            try {
                const content = await readFile(contextPath, "utf-8");
                return text(content);
            } catch {
                return text("CONTEXT.md not found. Try 'list_files' to explore the project structure.");
            }
        }

        // ── File reading ──────────────────────────────────────────────────────
        case "read_file": {
            const filePath = safePath(args.path as string);
            try {
                const content = await readFile(filePath, "utf-8");
                return text(content);
            } catch (e: any) {
                throw new McpError(ErrorCode.InvalidParams, `Cannot read file: ${e.message}`);
            }
        }

        // ── Directory listing ─────────────────────────────────────────────────
        case "list_files": {
            const dir = safePath((args.path as string) || "");
            const depth = (args.depth as number) || 3;
            const result = await sh(
                `find . ` +
                `-not -path '*/node_modules/*' ` +
                `-not -path '*/.git/*' ` +
                `-not -path '*/android/build/*' ` +
                `-not -path '*/android/.gradle/*' ` +
                `-not -path '*/.expo/*' ` +
                `-maxdepth ${depth} ` +
                `-type f | sort`,
                dir
            );
            return text(result);
        }

        // ── Git ───────────────────────────────────────────────────────────────
        case "git_log": {
            const count = (args.count as number) || 10;
            return text(await sh(`git log --oneline -${count}`));
        }

        case "git_status": {
            return text(await sh("git status && echo '---' && git diff --stat HEAD"));
        }

        case "git_commit_push": {
            const message = (args.message as string).replace(/"/g, '\\"');
            return text(await sh(`git add -A && git commit -m "${message}" && git push`));
        }

        // ── Version management ────────────────────────────────────────────────
        case "get_version": {
            return text(await sh("grep -E 'versionCode|versionName' android/app/build.gradle"));
        }

        case "bump_version": {
            const { versionCode, versionName } = args as { versionCode: number; versionName: string };
            await sh(`sed -i 's/versionCode [0-9]*/versionCode ${versionCode}/' android/app/build.gradle`);
            await sh(`sed -i 's/versionName "[^"]*"/versionName "${versionName}"/' android/app/build.gradle`);
            const verify = await sh("grep -E 'versionCode|versionName' android/app/build.gradle");
            return text(`✅ Version bumped:\n${verify}`);
        }

        // ── Build ─────────────────────────────────────────────────────────────
        case "build_release_aab": {
            const result = await sh("./gradlew bundleRelease --no-daemon 2>&1 | tail -40", join(PROJECT_ROOT, "android"), 360_000);
            const artifact = await sh("ls -lh android/app/build/outputs/bundle/release/app-release.aab 2>/dev/null || echo 'AAB not found'");
            return text(`Build output:\n${result}\n\nArtifact:\n${artifact}`);
        }

        case "build_release_apk": {
            const result = await sh("./gradlew assembleRelease --no-daemon 2>&1 | tail -40", join(PROJECT_ROOT, "android"), 360_000);
            const artifact = await sh("ls -lh android/app/build/outputs/apk/release/app-release.apk 2>/dev/null || echo 'APK not found'");
            return text(`Build output:\n${result}\n\nArtifact:\n${artifact}`);
        }

        case "get_build_artifacts": {
            const apk = await sh("ls -lh android/app/build/outputs/apk/release/app-release.apk 2>/dev/null || echo 'APK: not built yet'");
            const aab = await sh("ls -lh android/app/build/outputs/bundle/release/app-release.aab 2>/dev/null || echo 'AAB: not built yet'");
            return text(`APK → ${apk}\nAAB → ${aab}`);
        }

        default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Spense MCP server running (stdio)");
