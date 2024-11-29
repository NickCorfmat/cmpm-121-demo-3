import leaflet from "leaflet";

import { Cache } from "../prefabs/cache.ts";

// Class organization structure inspired by Mako1688, https://github.com/Mako1688/cmpm-121-demo-3/blob/main/src/board.ts

// Interfaces
export interface Cell {
  i: number;
  j: number;
}

// Board flyweight factory
export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;
  private readonly cacheStates: Map<string, string>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;

    this.knownCells = new Map<string, Cell>();
    this.cacheStates = new Map<string, string>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    // check if instance already exists, if not, create new Cell
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }

    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    // return grid cells in global coordinate system (anchored at 0N 0E)
    return this.getCanonicalCell({
      i: Math.floor(point.lat / this.tileWidth),
      j: Math.floor(point.lng / this.tileWidth),
    });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;

    // compute the corner lat/lng coordinates of a cell on the leaflet map
    const southwest = [i * this.tileWidth, j * this.tileWidth];
    const northeast = [(i + 1) * this.tileWidth, (j + 1) * this.tileWidth];

    return leaflet.latLngBounds([southwest, northeast]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);

    // retrieve all nearby cells within a certain radius of the origin
    for (
      let x = -this.tileVisibilityRadius;
      x <= this.tileVisibilityRadius;
      x++
    ) {
      for (
        let y = -this.tileVisibilityRadius;
        y <= this.tileVisibilityRadius;
        y++
      ) {
        const nearbyCell = this.getCanonicalCell({
          i: originCell.i + x,
          j: originCell.j + y,
        });

        resultCells.push(nearbyCell);
      }
    }

    return resultCells;
  }

  // Code section inspired by Mako1688.
  // I liked how they encapsulated the cache Momento pattern in board.ts

  // Save cache state on board as momento string
  setCache(i: number, j: number, cache: Cache): void {
    // save cache state
    const key = `${i},${j}`;
    const momento = cache.toMomento();
    this.cacheStates.set(key, momento);
  }

  // Retrieve cache by accessing its momento string
  getCache(i: number, j: number): Cache | null {
    const momento = this.cacheStates.get(`${i},${j}`);

    if (momento) {
      const cache = new Cache(i, j);
      cache.fromMomento(momento);

      return cache;
    }

    return null;
  }

  // Retrieve all cache states as one list
  getCacheData(): { key: string; momento: string }[] {
    const cacheStrings: { key: string; momento: string }[] = [];

    this.cacheStates.forEach((key, momento) => {
      cacheStrings.push({ key, momento });
    });

    return cacheStrings;
  }

  // Reinitialize board caches based on input list of cache states
  setCacheStates(caches: { key: string; momento: string }[]): void {
    caches.forEach(({ key, momento }) => {
      this.cacheStates.set(key, momento);
    });
  }
}
