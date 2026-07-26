import { describe, expect, it } from "vitest";
import { importImageAsFrame, loadProjectFile } from "@/animation/io";
import { Project } from "@/animation/types";

const validProject: Project = {
  id: "project-1",
  name: "Test project",
  width: 2,
  height: 2,
  bgColor: "transparent",
  fps: 12,
  loop: true,
  createdAt: 1,
  updatedAt: 1,
  frames: [{
    id: "frame-1",
    activeLayerId: "layer-1",
    hold: 1,
    layers: [{
      id: "layer-1",
      name: "Layer 1",
      visible: true,
      dataUrl: "data:image/png;base64,AAAA",
    }],
  }],
};

describe("project file IO", () => {
  it("loads a valid project file", async () => {
    const file = new File([JSON.stringify(validProject)], "project.json", { type: "application/json" });
    await expect(loadProjectFile(file)).resolves.toEqual(validProject);
  });

  it.each([
    { ...validProject, width: 0 },
    { ...validProject, frames: [] },
    { ...validProject, frames: [{ ...validProject.frames[0], activeLayerId: "missing" }] },
    { ...validProject, frames: [{ ...validProject.frames[0], layers: [{ ...validProject.frames[0].layers[0], dataUrl: "not-an-image" }] }] },
  ])("rejects an invalid project file", async (project) => {
    const file = new File([JSON.stringify(project)], "invalid.json", { type: "application/json" });
    await expect(loadProjectFile(file)).rejects.toThrow("Invalid project file");
  });

  it("imports an image as a data URL", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "image.png", { type: "image/png" });
    await expect(importImageAsFrame(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
