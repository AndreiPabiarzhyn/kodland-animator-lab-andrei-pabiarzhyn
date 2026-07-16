import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const TIPS: Record<string, string[]> = {
  basics: [
    "Start with a low frame count (4–8) and short loops to iterate quickly.",
    "Use onion skin to see the previous frame while drawing the next one.",
    "Duplicate a frame (D) instead of redrawing when only small parts change.",
  ],
  timing: [
    "12 fps feels classic and hand-drawn; 24 fps looks smoother.",
    "Hold important poses for 2–3 frames to make actions readable.",
    "Add ease-in/ease-out by clustering more frames near the start and end of a move.",
  ],
  drawing: [
    "Block big shapes with the shape tools, then refine with the pencil.",
    "Keep the outline on one layer and colors on another so you can recolor freely.",
    "Use the color picker (I) to sample colors instead of remixing them.",
  ],
  export: [
    "Animated GIF is best for sharing loops on the web.",
    "PNG sequence gives you full-quality per-frame files for editing elsewhere.",
    "Save the .json project to keep layers and timeline editable later.",
  ],
};

export default defineTool({
  name: "get_animation_tips",
  title: "Get animation tips",
  description: "Returns short, kid-friendly frame-by-frame animation tips grouped by topic (basics, timing, drawing, export).",
  inputSchema: {
    topic: z
      .enum(["basics", "timing", "drawing", "export", "all"])
      .default("all")
      .describe("Which tip category to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ topic }) => {
    const selected =
      topic === "all"
        ? TIPS
        : { [topic]: TIPS[topic] };
    const text = Object.entries(selected)
      .map(([k, list]) => `# ${k}\n- ${list.join("\n- ")}`)
      .join("\n\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { tips: selected },
    };
  },
});