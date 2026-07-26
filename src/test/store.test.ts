import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/animation/store";

describe("animation store", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().newProject(4, 3);
  });

  it("adds, duplicates, moves, and deletes frames", () => {
    const store = useStore.getState();
    const firstId = store.project.frames[0].id;
    const drawing = "data:image/png;base64,drawing";
    store.updateActiveLayerData(drawing);

    store.addFrame();
    expect(useStore.getState().project.frames).toHaveLength(2);
    expect(useStore.getState().currentFrame).toBe(1);

    store.duplicateFrame(0);
    const state = useStore.getState();
    expect(state.project.frames).toHaveLength(3);
    expect(state.project.frames[1].id).not.toBe(firstId);
    expect(state.project.frames[1].layers[0].id).not.toBe(state.project.frames[0].layers[0].id);
    expect(state.project.frames[1].layers[0].dataUrl).toBe(drawing);

    state.moveFrame(2, 0);
    expect(useStore.getState().project.frames).toHaveLength(3);
    state.deleteFrame(1);
    expect(useStore.getState().project.frames).toHaveLength(2);
  });

  it("supports layer edits with undo and redo", () => {
    const store = useStore.getState();
    const initial = store.project.frames[0].layers[0].dataUrl;
    const changed = "data:image/png;base64,changed";

    store.updateActiveLayerData(changed, initial);
    expect(useStore.getState().project.frames[0].layers[0].dataUrl).toBe(changed);
    expect(store.canUndo()).toBe(true);

    store.undo();
    expect(useStore.getState().project.frames[0].layers[0].dataUrl).toBe(initial);
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(useStore.getState().project.frames[0].layers[0].dataUrl).toBe(changed);
  });

  it("persists and restores the current project", () => {
    const store = useStore.getState();
    store.setProjectMeta({ name: "Saved animation" });
    store.saveToLocalStorage();
    store.newProject(8, 8);
    expect(useStore.getState().project.name).toBe("My Animation");

    store.loadFromLocalStorage();
    expect(useStore.getState().project.name).toBe("Saved animation");
    expect(useStore.getState().project.width).toBe(4);
  });
});
