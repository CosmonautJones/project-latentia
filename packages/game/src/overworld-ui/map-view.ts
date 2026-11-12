// Draws one area of the world: a Phaser tilemap of the art pass's 24 px tileset (the wild patch swaying in its frames),
// the NPCs standing in it, and the wild model's eyes in the patch while the encounter is live. Rebuilt on each warp.
// Around the area runs a border of scenery (overworld/border.ts), so a map smaller than the view, which the camera
// centres, or a view at the map's edge, never shows a bare edge: the forest goes on, and a building's interior sits
// in the dark.

import type Phaser from 'phaser';
import { lurkFrames, patchAnim, sheetKey, tileFrame, TILESET_ID } from '../art/sheets.js';
import type { OverworldStep } from '../flow/flow.js';
import { BORDER, borderedTiles } from '../overworld/border.js';
import type { Area, Pos, World } from '../overworld/map.js';
import { allNpcs, encounterLive } from '../overworld/rules.js';
import { TILE } from '../overworld/tile.js';
import { Actor } from './actor.js';

const LURK_DEPTH = 5;
/** The eyes stay open most of the time and blink once every this many sways. */
const BLINK_EVERY = 5;

export class MapView {
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private lurk: Phaser.GameObjects.Image | null = null;
  private readonly npcs = new Map<string, Actor>();
  private patches: Pos[] = [];
  private current: Area | null = null;
  private clockMs = 0;
  private tick_ = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    private readonly step: OverworldStep,
  ) {}

  get area(): Area {
    if (!this.current) throw new Error('no area shown');
    return this.current;
  }

  /** Pixel size of the shown area (the border is outside it). */
  get size(): { width: number; height: number } {
    return { width: this.area.width * TILE, height: this.area.height * TILE };
  }

  actor(id: string): Actor | undefined {
    return this.npcs.get(id);
  }

  show(areaId: string): void {
    const area = this.world.areas[areaId];
    if (!area) throw new Error(`no area ${areaId}`);
    this.clear();
    this.current = area;
    const data = borderedTiles(area).map((row) => row.map((k) => tileFrame(k)));
    const key = sheetKey(TILESET_ID);
    this.map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = this.map.addTilesetImage(key, key, TILE, TILE, 0, 0);
    if (!tiles) throw new Error('tileset missing');
    this.layer = this.map.createLayer(0, tiles, -BORDER * TILE, -BORDER * TILE) as Phaser.Tilemaps.TilemapLayer;
    this.patches = area.tiles.flatMap((k, i) => (k === 'patch' ? [{ x: i % area.width, y: Math.floor(i / area.width) }] : []));
    this.tick_ = -1;

    const { lurk } = this.world.encounter;
    if (encounterLive(this.step) && this.world.encounter.area === areaId) {
      this.lurk = this.scene.add.image(lurk.x * TILE, lurk.y * TILE, key, lurkFrames[0]).setOrigin(0).setDepth(LURK_DEPTH);
    }
    for (const npc of allNpcs(this.world)) if (npc.at.area === areaId) this.npcs.set(npc.id, new Actor(this.scene, npc.id, npc.at));
    this.tick(0);
  }

  /** The wild model has been found: its eyes leave the patch. */
  hideLurk(): void {
    this.lurk?.destroy();
    this.lurk = null;
  }

  /** Advance the patch sway and the lurker's blink. */
  tick(deltaMs: number): void {
    this.clockMs += deltaMs;
    const tick = Math.floor(this.clockMs / patchAnim.frameMs);
    if (tick === this.tick_ || !this.layer) return;
    this.tick_ = tick;
    const index = patchAnim.frames[tick % patchAnim.frames.length] ?? tileFrame('patch');
    for (const p of this.patches) this.layer.putTileAt(index, p.x + BORDER, p.y + BORDER);
    this.lurk?.setFrame(lurkFrames[tick % BLINK_EVERY === BLINK_EVERY - 1 ? 1 : 0] ?? 0);
  }

  private clear(): void {
    for (const a of this.npcs.values()) a.destroy();
    this.npcs.clear();
    this.hideLurk();
    this.layer?.destroy();
    this.map?.destroy();
    this.layer = null;
    this.map = null;
  }
}
