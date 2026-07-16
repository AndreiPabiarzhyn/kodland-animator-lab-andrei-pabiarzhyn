import { defineMcp } from "@lovable.dev/mcp-js";
import getAppInfo from "./tools/get-app-info";
import listShortcuts from "./tools/list-shortcuts";
import animationTips from "./tools/animation-tips";

export default defineMcp({
  name: "kodflip-mcp",
  title: "KodFlip Animation Studio",
  version: "0.1.0",
  instructions:
    "Public read-only tools describing KodFlip, a browser-based frame-by-frame animation studio for kids. Use `get_app_info` for capabilities, `list_keyboard_shortcuts` for editor shortcuts, and `get_animation_tips` for kid-friendly animation guidance.",
  tools: [getAppInfo, listShortcuts, animationTips],
});