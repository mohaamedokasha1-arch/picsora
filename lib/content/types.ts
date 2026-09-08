/** Shared shapes for server-side editorial content (lib/content). */

export interface ToolDeepDive {
  /** Section heading, written uniquely per tool. */
  title: string;
  paragraphs: string[];
  useCases: string[];
}
