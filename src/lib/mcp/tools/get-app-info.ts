import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_app_info",
  title: "Get app info",
  description: "Returns metadata about KodFlip — a frame-by-frame 2D animation studio for kids: name, description, supported export formats, and canvas capabilities.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      name: "KodFlip",
      tagline: "Animation Studio for Kids",
      description:
        "A fun, powerful frame-by-frame 2D animation studio in the browser for kids 10–14. Draw, animate and export.",
      capabilities: {
        drawingTools: ["pencil", "eraser", "fill", "shapes (line/rect/circle)", "color picker", "selection/transform", "move/pan"],
        layers: true,
        onionSkin: true,
        timeline: true,
        exportFormats: ["Animated GIF", "PNG sequence (.zip)", "Project (.json)"],
        maxCanvas: { width: 1920, height: 1920 },
      },
      author: "Andrei Pobiarzhyn",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});