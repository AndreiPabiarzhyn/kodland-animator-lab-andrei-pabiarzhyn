import { defineTool } from "@lovable.dev/mcp-js";

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "P", action: "Pencil" },
  { keys: "E", action: "Eraser" },
  { keys: "G", action: "Fill" },
  { keys: "S", action: "Select / Transform" },
  { keys: "I", action: "Color picker" },
  { keys: "[ / ]", action: "Decrease / Increase tool size" },
  { keys: "N", action: "New frame" },
  { keys: "D", action: "Duplicate frame" },
  { keys: "Space", action: "Play / Pause" },
  { keys: "← / →", action: "Previous / Next frame" },
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Shift+Z", action: "Redo" },
  { keys: "Scroll", action: "Zoom canvas" },
  { keys: "Shift+Drag", action: "Pan canvas" },
  { keys: "Enter / Esc", action: "Apply / Cancel selection" },
];

export default defineTool({
  name: "list_keyboard_shortcuts",
  title: "List keyboard shortcuts",
  description: "Returns the full list of keyboard shortcuts available in the KodFlip animation editor.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: SHORTCUTS.map((s) => `${s.keys.padEnd(14)} — ${s.action}`).join("\n"),
      },
    ],
    structuredContent: { shortcuts: SHORTCUTS },
  }),
});