export interface ParsedFilePath {
  raw: string;
  filePath: string;
  line?: number;
  column?: number;
  isRecognized: boolean;
}

const FILE_PATH_REGEX =
  /^(\/?(?:[\w.-]+\/)*[\w.-]+\.(?:go|ts|tsx|js|jsx|json|yaml|yml|md|sql|proto|rs|py|c|cpp|h|css|scss|html|sh|bash|toml|env))(?::(\d+))?(?::(\d+))?$/i;

/**
 * Parses inline text or code strings into source file paths with optional line numbers.
 */
export function parseSourceFilePath(text: string): ParsedFilePath | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const match = trimmed.match(FILE_PATH_REGEX);
  if (!match) return null;

  return {
    raw: trimmed,
    filePath: match[1],
    line: match[2] ? Number.parseInt(match[2], 10) : undefined,
    column: match[3] ? Number.parseInt(match[3], 10) : undefined,
    isRecognized: true,
  };
}

/**
 * Builds IDE protocol URL (`vscode://file/...` or `cursor://file/...`).
 */
export function getIDELink(filePath: string, line?: number, column?: number, ide: "vscode" | "cursor" = "vscode"): string {
  const lineSuffix = line ? `:${line}${column ? `:${column}` : ""}` : "";
  const cleanPath = filePath.startsWith("/") ? filePath : `${filePath}`;
  return `${ide}://file/${cleanPath}${lineSuffix}`;
}
