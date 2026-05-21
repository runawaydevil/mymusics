import { describe, expect, it, beforeEach, afterEach } from "vitest";

import type { TrackMeta } from "./metadata.js";
import { WritableTrackStore } from "./trackStore.js";

const SAMPLE: TrackMeta[] = [
  {
    id: "1",
    title: "Moon Song",
    artist: "Bill Nelson",
    fileKey: "a.mp3",
    cdnUrl: "http://cache06-music02.myspacecdn.com/46/std_a.mp3",
    archiveUrl: "https://archive.org/download/myspace_dragon_hoard_2010/46.zip/46%2Fa.mp3",
  },
  {
    id: "2",
    title: "Fire Track",
    artist: "Other Artist",
    fileKey: "b.mp3",
    cdnUrl: "http://cache06-music02.myspacecdn.com/46/std_b.mp3",
    archiveUrl: "https://archive.org/download/myspace_dragon_hoard_2010/46.zip/46%2Fb.mp3",
  },
];

describe("TrackStore", () => {
  let store: WritableTrackStore;

  beforeEach(() => {
    store = new WritableTrackStore(":memory:");
    store.open();
    store.insertBatch(SAMPLE);
    store.finishIndex();
  });

  afterEach(() => {
    store.close();
  });

  it("counts tracks", () => {
    expect(store.count()).toBe(2);
  });

  it("gets by id", () => {
    const t = store.getById("1");
    expect(t?.title).toBe("Moon Song");
  });

  it("searches by artist", () => {
    const hits = store.search("Bill", 10);
    expect(hits.some((h) => h.id === "1")).toBe(true);
  });

  it("excludes blocked ids from random", () => {
    store.blockId("1");
    const t = store.random();
    expect(t?.id).toBe("2");
  });
});
