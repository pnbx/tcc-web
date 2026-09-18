// Permission catalog + default role→permission mapping.
// The backend enforces these on every privileged endpoint; the UI only *hides*
// what the user cannot do — it never grants anything.

export const PERMISSIONS = {
  // Server
  "server.view": "View server status and basic info",
  "server.start": "Start the Minecraft server",
  "server.stop": "Stop the Minecraft server",
  "server.restart": "Restart the Minecraft server",
  "server.console": "View the live console",
  "server.command": "Send commands to the server",
  "server.broadcast": "Broadcast messages to players",
  "server.metrics": "View detailed metrics (TPS/MSPT/CPU/RAM/disk/net)",

  // Files (developer)
  "files.view": "Browse and read server files",
  "files.edit": "Edit server files",
  "files.create": "Create server files",
  "files.delete": "Delete server files",
  "files.upload": "Upload server files",
  "files.download": "Download server files",

  // Logs
  "logs.view": "View server and web logs",
  "logs.download": "Download log exports",

  // Plugins
  "plugins.view": "View installed plugins",
  "plugins.manage": "Enable/disable/reload plugins",

  // Players
  "players.view": "Search and view players",
  "players.edit": "Edit player records",
  "players.ban": "Ban and unban players",
  "players.link": "Link/unlink Minecraft accounts",

  // Tiers
  "tiers.view": "View the tier list",
  "tiers.create": "Create tiers and categories",
  "tiers.edit": "Edit/rename/reorder tiers",
  "tiers.delete": "Delete tiers",
  "tiers.assign": "Assign players to tiers",

  // News
  "news.view": "Access draft news",
  "news.create": "Create news articles",
  "news.edit": "Edit news articles",
  "news.delete": "Delete news articles",
  "news.publish": "Publish/unpublish news",

  // Store
  "store.view": "View products and orders",
  "store.create": "Create products",
  "store.edit": "Edit products",
  "store.delete": "Delete products",
  "orders.view": "View orders",
  "orders.refund": "Refund orders",

  // Users / roles
  "users.view": "View website users",
  "users.roles": "Assign roles to users",
  "audit.view": "View the audit log",
  "settings.manage": "Change platform settings",

  // Dashboard
  "panel.admin": "Access /admin",
  "panel.owner": "Access /owner",
  "panel.developer": "Access /developer",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLES = ["MEMBER", "MODERATOR", "ADMIN", "OWNER", "DEVELOPER"] as const;
export type RoleName = (typeof ROLES)[number];

const ALL = [...PERMISSION_KEYS];

// Wildcard support: OWNER holds "*" and matches everything.
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, string[]> = {
  OWNER: ["*"],
  DEVELOPER: ALL,
  ADMIN: [
    "server.view", "server.command", "server.metrics", "logs.view",
    "players.view", "players.edit", "players.ban", "players.link",
    "tiers.view", "tiers.create", "tiers.edit", "tiers.delete", "tiers.assign",
    "news.view", "news.create", "news.edit", "news.delete", "news.publish",
    "store.view", "store.create", "store.edit", "store.delete", "orders.view", "orders.refund",
    "users.view", "users.roles", "audit.view", "settings.manage",
    "panel.admin",
  ],
  MODERATOR: ["players.view", "players.ban", "tiers.view", "news.view", "store.view", "orders.view", "panel.admin"],
  MEMBER: [],
};

export function permissionsFor(roles: string[], extra: string[] = []): Set<string> {
  const set = new Set<string>(extra);
  for (const r of roles) {
    const perms = ROLE_DEFAULT_PERMISSIONS[r as RoleName];
    if (perms) for (const p of perms) set.add(p);
  }
  return set;
}

export function hasPermission(permissions: Set<string>, key: PermissionKey | string): boolean {
  return permissions.has("*") || permissions.has(key);
}
