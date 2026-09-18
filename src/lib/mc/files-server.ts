import "server-only";

export function isFileSandboxConfigured(): boolean {
  return !!process.env.SERVER_FILES_ROOT;
}
