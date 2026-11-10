// Draws one area of the world: a Phaser tilemap of the generated tiles (the wild patch swaying in 2 frames), the
// NPCs standing in it, and the wild model's eyes in the patch while the encounter is live. Rebuilt on each warp.

import Phaser from 'phaser';
import type { OverworldStep } from '../flow/flow.js';
import type { Area, Pos, World } from '../overworld/map.js';
import { allNpcs, encounterLive } from '../overworld/rules.js';
import { PATCH_FRAME_MS, TILE, tileIndex } from '../overworld/tile-art.js';
import { Actor } from './actor.js';
import { LURK_KEY, TILESET_KEY } from './textures.js';

const LURK_DEPTH = 5;

export class MapView {
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private lurk: Phaser.GameObjects.Image | null = null;
  private readonly npcs = new Map<string, Actor>();
  private patches: Pos[] = [];
  private current: Area | null = null;
  private clockMs = 0;
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    private readonly step: OverworldStep,
  ) {}

  get area(): Area {
    if (!this.current) throw new Error('no area shown');
    return this.current;
  }

  /** Pixel size of the shown area. */
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
    const data = Array.from({ length: area.height }, (_, y) => area.tiles.slice(y * area.width, (y + 1) * area.width).map((k) => tileIndex(k)));
    this.map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = this.map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, 0, 0);
    if (!tiles) throw new Error('tileset missing');
    this.layer = this.map.createLayer(0, tiles, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.patches = area.tiles.flatMap((k, i) => (k === 'patch' ? [{ x: i % area.width, y: Math.floor(i / area.width) }] : []));
    this.frame = 0;

    const { lurk } = this.world.encounter;
    if (encounterLive(this.step) && this.world.encounter.area === areaId) {
      this.lurk = this.scene.add.image(lurk.x * TILE, lurk.y * TILE, LURK_KEY, 0).setOrigin(0).setDepth(LURK_DEPTH);
    }
    for (const npc of allNpcs(this.world)) if (npc.at.area === areaId) this.npcs.set(npc.id, new Actor(this.scene, npc.look, npc.at));
  }

  /** The wild model has been found: its eyes leave the patch. */
  hideLurk(): void {
    this.lurk?.destroy();
    this.lurk = null;
  }

  /** Advance the patch sway and the lurker's blink. */
  tick(deltaMs: number): void {
    this.clockMs += deltaMs;
    const frame = Math.floor(this.clockMs / PATCH_FRAME_MS) % 2;
    if (frame === this.frame || !this.layer) return;
    this.frame = frame;
    const index = tileIndex('patch', frame);
    for (const p of this.patches) this.layer.putTileAt(index, p.x, p.y);
    // The eyes stay open most of the time and blink once every few sways.
    this.lurk?.setFrame(Math.floor(this.clockMs / PATCH_FRAME_MS) % 5 === 4 ? 1 : 0);
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
