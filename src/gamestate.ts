import leaflet from "leaflet";
import { Player } from "./prefabs/player.ts";
import { Board } from "./prefabs/board.ts";
import { Coin } from "./prefabs/cache.ts";

export class GameState {
  private player: Player;
  private board: Board;
  private localStorageKey: string;

  constructor(player: Player, board: Board, localStorageKey: string) {
    this.player = player;
    this.board = board;
    this.localStorageKey = localStorageKey;
  }

  // Local storage system inspired by Mako1688, https://github.com/Mako1688/cmpm-121-demo-3/blob/main/src/main.ts
  saveGameState(): void {
    const gameState = {
      player: this.player.toJSON(),
      caches: this.board.getCacheData(),
    };

    localStorage.setItem(this.localStorageKey, JSON.stringify(gameState));
  }

  loadGameState(): void {
    const data = localStorage.getItem(this.localStorageKey);

    if (data) {
      const gameState = JSON.parse(data);

      if (!gameState) return; // exit if no previous game state exists

      // initialize game parameters from previous save
      this.player = gameState.player;
      this.board.setCacheStates(gameState.caches);

      // convert local storage data back to Coins
      this.player.inventory = gameState.playerInventory.map(
        (coinData: { i: number; j: number; serial: string }) =>
          new Coin(coinData.i, coinData.j, coinData.serial),
      );

      // display player at previous saved state's location
      this.player.path.setLatLngs([]);
      //showNearbyCaches();

      this.player.updateInventoryPanel();
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
    //player.updateInventoryPanel();

    // override local game data
    localStorage.clear();
    //saveGameState();
  }
}
