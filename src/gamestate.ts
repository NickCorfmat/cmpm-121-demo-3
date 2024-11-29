import leaflet from "leaflet";
import { Player } from "./prefabs/player.ts";
import { Board } from "./prefabs/board.ts";

export class GameState {
  private player: Player;
  private board: Board;
  private key: string;

  constructor(player: Player, board: Board, key: string) {
    this.player = player;
    this.board = board;
    this.key = key;
  }

  save(): void {
    const gameState = {
      player: this.player.toJSON(),
      caches: this.board.getCacheData(),
    };

    localStorage.setItem(this.key, JSON.stringify(gameState));
  }

  load(): void {
    const data = localStorage.getItem(this.key);

    if (data) {
      const gameState = JSON.parse(data);

      // exit if no previous game state exists
      if (!gameState) return;

      // initialize game parameters from previous save
      this.player.fromJSON(gameState.player);
      this.board.setCacheStates(gameState.caches);
    }
  }

  reset(initialLocation: leaflet.LatLng): void {
    // return all coins from player inventory back to original caches
    this.player.inventory.forEach((coin) => {
      const { i, j } = coin;
      const originalCache = this.board.getCache(i, j);

      originalCache?.coins.push(coin);
      this.board.setCache(i, j, originalCache!);
    });

    this.player.reset(initialLocation);

    localStorage.clear();
  }
}
