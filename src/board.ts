import leaflet from "leaflet";

// Import Cell interface defined in main.ts
import { Cell } from "./main.ts";

// Board flyweight factory
export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
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
      i: Math.trunc(point.lat / this.tileWidth),
      j: Math.trunc(point.lng / this.tileWidth),
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

    // Retrieve all nearby cells within a certain radius of the origin
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
}
