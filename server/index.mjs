#!/usr/bin/env node
/**
 * CineApp for Claude — the MCP server inside the Claude Desktop extension.
 *
 * Lets Claude drive the CineApp menu-bar app directly, with no terminal.
 * Speaks MCP over stdio (newline-delimited JSON-RPC 2.0) and shells out to the
 * `cineapp` CLI that ships inside CineApp.app, so it stays in step with the app.
 *
 * Deliberately dependency-free — no npm install, nothing to keep updated.
 * The same file runs for Claude Code (~/.claude/mcp-servers/cineapp-mcp.mjs).
 *
 * Nothing that spends credits starts from here on its own: films, sheets,
 * audio, music and images all stop on the Mac for the person's own click
 * ("Yes" / "Not yet") inside CineApp before a cent is spent.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';

const VERSION = '1.2.1';

// Prefer the binary inside the installed app; fall back to the PATH symlink.
const CANDIDATES = [
  '/Applications/CineApp.app/Contents/MacOS/cineapp',
  join(homedir(), 'Applications/CineApp.app/Contents/MacOS/cineapp'),
  join(homedir(), '.local/bin/cineapp'),
  '/usr/local/bin/cineapp',
  // older installs, from before the app was called CineApp
  '/Applications/Voxbot.app/Contents/MacOS/voxbot',
  join(homedir(), '.local/bin/voxbot'),
  '/usr/local/bin/voxbot',
];
function cineappPath() {
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

const ORGANIZE_SH = join(
  homedir(),
  'Library/Application Support/VoiceType/organize.sh',
);

function run(bin, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = String(stdout || '').trim();
        const errOut = String(stderr || '').trim();
        if (err && err.killed) {
          resolve({ ok: false, text: `Timed out after ${Math.round(timeoutMs / 1000)}s.` });
        } else if (err && !out && errOut) {
          resolve({ ok: false, text: errOut });
        } else if (err && !out) {
          resolve({ ok: false, text: String(err.message || err) });
        } else {
          resolve({ ok: !err, text: out || errOut || '(no output)' });
        }
      });
  });
}

async function callCineApp(args, timeoutMs) {
  const bin = cineappPath();
  if (!bin) {
    return {
      ok: false,
      text: 'CineApp is not installed — get it at https://zxrstudios.com/cineapp and open it once.',
    };
  }
  return run(bin, args, timeoutMs);
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const TOOLS = [
  {
    name: 'cineapp_ping',
    description:
      'Check that the CineApp app is installed and running. Returns its version. Read-only and instant — use this first if anything seems wrong.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Is CineApp running?', ...READ_ONLY },
  },
  {
    name: 'cineapp_projects',
    description: 'List every CineApp film project on this Mac. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List projects', ...READ_ONLY },
  },
  {
    name: 'cineapp_status',
    description:
      'Where a CineApp film project stands (concept, sheets, audio, film, approvals). Read-only. Omit project for the current one.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name. Optional.' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'Project status', ...READ_ONLY },
  },
  {
    name: 'cineapp_sheets',
    description:
      'The character, prop and location sheets of a CineApp film project, as JSON with image links. Read-only. Omit project for the current one.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name. Optional.' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'Project sheets', ...READ_ONLY },
  },
  {
    name: 'cineapp_organize_folder',
    description:
      "Sort files in a folder into type sub-folders (Images, Videos, Documents, Audio, Archives, Code, Apps, Other). MOVES FILES — confirm with the user first. By default only the folder's own files are touched; set depth to also tidy files inside sub-folders.",
    inputSchema: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description:
            "Folder name like Downloads or Desktop, or a full path starting with /.",
        },
        depth: {
          type: 'string',
          description:
            "How many levels to organize. '1' (default) = this folder's own files only. '2' or '3' = that many levels of sub-folders. 'all' = every level.",
        },
      },
      required: ['folder'],
      additionalProperties: false,
    },
    annotations: { title: 'Organize a folder', destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'cineapp_type',
    description:
      'Type text wherever the cursor currently is. SIDE-EFFECTING — it types into whatever app is focused, so confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to type.' } },
      required: ['text'],
      additionalProperties: false,
    },
    annotations: { title: 'Type at the cursor', destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'cineapp_do',
    description:
      "Send a free-form request to CineApp's own agent, exactly as if spoken to the app — open and control apps (After Effects, Premiere, Photoshop, Finder…), type, look at the screen, run CineApp's film factory. POWERFUL AND SIDE-EFFECTING — confirm the exact wording with the user first. Anything that spends credits (films, renders, sheets, audio, music, images) does NOT start from here: CineApp shows a Yes / Not yet card on the Mac and waits for the person's own click, so tell them to check their Mac. Can run for many minutes.",
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'What you want CineApp to do, in plain language.',
        },
      },
      required: ['request'],
      additionalProperties: false,
    },
    annotations: { title: 'Ask CineApp to do something', destructiveHint: true, openWorldHint: true },
  },
  {
    name: 'cineapp_teach_skill',
    description:
      "Teach one of the person's CineApp bots a Claude skill from this Mac: a skill folder, a .skill file, a .zip, or a SKILL.md. The skill's instructions become part of how that bot works (e.g. teach the Editor a trailer-editing skill). Private to their account. Only SKILL.md is used; a package's reference files stay on the Mac.",
    inputSchema: {
      type: 'object',
      properties: {
        bot: { type: 'string', description: "Which bot: 'director', 'editor', 'producer', 'writer', 'dp', 'designer' (motion graphics), or the name of one they made." },
        path: { type: 'string', description: 'Absolute path to the skill folder, .skill, .zip or SKILL.md.' },
      },
      required: ['bot', 'path'],
      additionalProperties: false,
    },
    annotations: { title: 'Teach a bot a skill', destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'cineapp_add_bot',
    description:
      "Add a bot to the person's CineApp crew from a JSON template you wrote — or, with `replaces`, their own version of a default role. Everything added this way is PRIVATE to their account. Use this when they ask you to BUILD them a bot or a skill: design it here, then push it in. It joins the crew on their Mac immediately AND is saved to their CineApp account, so the same bot is waiting on every machine they sign in on. Not destructive and it spends nothing, but it does change their crew — show them the template first.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The bot's name, e.g. 'Trailer cutter'." },
        description: {
          type: 'string',
          description: 'One or two sentences on what it does and when to call on it.',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Tool names it may call — e.g. read_webpage, deep_research, write_prompt, generate_image, edit_image, learn_from_video, open_app, look_at_screen. Anything that isn't a real tool name is kept as part of its About text, not as a tool. Omit for the standard set.",
        },
        about: {
          type: 'string',
          description:
            'A fuller description shown when someone clicks the bot: what it does, what it is best at, and how it differs from similar bots on the crew. Optional.',
        },
        id: {
          type: 'string',
          description: "An existing bot's id to update (rename it, rewrite its description) instead of adding a new one. Optional.",
        },
        memories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Facts it should always know. Optional.',
        },
        color: { type: 'string', description: "Hex colour for its mascot, e.g. '#7d6bff'. Optional." },
        style: {
          type: 'string',
          description: "Mascot shape: mascot, bean, pear, egg, hex, capsule, teardrop, potato, button. Optional.",
        },
        replaces: {
          type: 'string',
          enum: ['director', 'producer', 'editor', 'writer', 'cinematographer', 'designer', 'vfx',
                 'artist3d', 'sounddesigner', 'colorist', 'storyboardartist'],
          description:
            "Make this the person's OWN version of a default role instead of a new bot — e.g. 'director' for their custom Director. It takes over that role on their account only (shown as 'Director <their initials>'); the stock one stays underneath and they can switch back. Private to their account; nobody else gets it unless they share it.",
        },
        reportsTo: {
          type: 'string',
          enum: ['producer', 'editor'],
          description:
            "Which lead it works under. The Director runs the film; the Producer leads PRODUCTION (writing, images, design, storyboards) and the Editor leads POST (the cut, VFX, colour, sound). Default: producer.",
        },
      },
      required: ['name', 'description'],
      additionalProperties: false,
    },
    annotations: { title: 'Add a bot to CineApp', destructiveHint: false, openWorldHint: false },
  },
];
// MCP's own display name for each tool (newer clients show it instead of the tool's id)
for (const t of TOOLS) t.title = t.annotations.title;

async function dispatch(name, args) {
  // cineapp_* since Nov 24 2026 (owner: "100% CineApp, not Voxbot"); the old voxbot_* names still work for chats
  // and clients that remember them.
  switch (String(name || '').replace(/^(cineapp|voxbot)_/, '')) {
    case 'ping':
      return callCineApp(['ping'], 30_000);
    case 'projects':
      return callCineApp(['projects'], 30_000);
    case 'status':
      return callCineApp(
        args?.project ? ['status', String(args.project)] : ['status'],
        30_000,
      );
    case 'sheets':
      return callCineApp(
        args?.project ? ['sheets', String(args.project)] : ['sheets'],
        30_000,
      );
    case 'type':
      if (!args?.text) return { ok: false, text: 'text is required.' };
      return callCineApp(['type', String(args.text)], 30_000);
    case 'do':
      if (!args?.request) return { ok: false, text: 'request is required.' };
      return callCineApp(['do', String(args.request)], 960_000);
    case 'teach_skill':
      if (!args?.bot || !args?.path) return { ok: false, text: 'bot and path are required.' };
      return callCineApp(['teach', String(args.bot), String(args.path)], 60_000);
    case 'add_bot': {
      if (!args?.name) return { ok: false, text: 'name is required.' };
      const bot = {
        name: String(args.name),
        description: String(args.description ?? ''),
        skills: Array.isArray(args.skills) ? args.skills.map(String) : [],
        memories: Array.isArray(args.memories) ? args.memories.map(String) : [],
      };
      if (args.about) bot.about = String(args.about);
      if (args.id) bot.id = String(args.id);
      if (args.color) bot.color = String(args.color);
      if (args.style) bot.style = String(args.style);
      if (args.reportsTo === 'editor' || args.reportsTo === 'producer') bot.reportsTo = args.reportsTo;
      if (args.replaces) bot.replaces = String(args.replaces);
      return callCineApp(['add-bot', JSON.stringify(bot)], 60_000);
    }
    case 'organize_folder': {
      if (!args?.folder) return { ok: false, text: 'folder is required.' };
      const depth = args.depth ? String(args.depth) : '1';
      if (existsSync(ORGANIZE_SH)) {
        // Call the organizer directly — deterministic, no LLM in the loop.
        return run('/bin/zsh', [ORGANIZE_SH, String(args.folder), depth], 600_000);
      }
      const phrase =
        depth === '1'
          ? `organize my ${args.folder}`
          : `organize my ${args.folder} including sub-folders ${depth} levels deep`;
      return callCineApp(['do', phrase], 600_000);
    }
    default:
      return { ok: false, text: `Unknown tool: ${name}` };
  }
}

// ── JSON-RPC over stdio ────────────────────────────────────────────────
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) =>
  send({ jsonrpc: '2.0', id, error: { code, message } });

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  // Notifications carry no id and expect no response.
  if (id === undefined || id === null) return;

  try {
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'cineapp', title: 'CineApp', version: VERSION },
          instructions:
            "CineApp is the person's voice assistant on this Mac. Use cineapp_do for anything — apps, typing, the screen, films. Check cineapp_ping first if unsure it's running. Anything that costs credits waits for the person's own Yes on their Mac.",
        });
      case 'ping':
        return reply(id, {});
      case 'tools/list':
        return reply(id, { tools: TOOLS });
      case 'tools/call': {
        const res = await dispatch(params?.name, params?.arguments || {});
        return reply(id, {
          content: [{ type: 'text', text: res.text }],
          isError: !res.ok,
        });
      }
      case 'resources/list':
        return reply(id, { resources: [] });
      case 'prompts/list':
        return reply(id, { prompts: [] });
      default:
        return fail(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return fail(id, -32603, String(e?.message || e));
  }
});
