import { ExternalLinkIcon } from "lucide-react";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { getIDELink, parseSourceFilePath } from "@/utils/ideLink";
import type { ReactMarkdownProps } from "./types";

interface InlineCodeProps extends React.HTMLAttributes<HTMLElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Inline code component with background, monospace font, and IDE launcher on recognized source file paths.
 */
export const InlineCode = ({ children, className, node: _node, ...props }: InlineCodeProps) => {
  const textContent = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
  const parsedFile = parseSourceFilePath(textContent);

  if (parsedFile) {
    const vscodeUrl = getIDELink(parsedFile.filePath, parsedFile.line, parsedFile.column, "vscode");

    return (
      <span className="inline-flex items-center gap-0.5 group/filepath">
        <code className={cn(markdownStyles.inlineCode, className, "text-primary/90 hover:text-primary")} {...props}>
          {children}
        </code>
        <a
          href={vscodeUrl}
          className="inline-flex items-center text-muted-foreground/60 hover:text-primary transition-opacity opacity-0 group-hover/filepath:opacity-100 p-0.5 rounded text-[10px]"
          title={`Open in IDE (${parsedFile.raw})`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon className="size-2.5" />
        </a>
      </span>
    );
  }

  return (
    <code className={cn(markdownStyles.inlineCode, className)} {...props}>
      {children}
    </code>
  );
};
