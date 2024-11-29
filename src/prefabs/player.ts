import leaflet from "leaflet";
import { Coin } from "./cache.ts";

export class Player {
  location: leaflet.LatLng;
  inventory: Coin[];
  moveHistory: leaflet.LatLng[];
  path: leaflet.Polyline;

  constructor(initialLocation: leaflet.LatLng) {
    this.location = initialLocation;
    this.inventory = [];
    this.moveHistory = [];
    this.path = leaflet.polyline([], {
      color: "red",
      weight: 5,
      opacity: 0.3,
    });
  }

  moveTo(newLocation: leaflet.LatLng, map: leaflet.Map): void {
    this.location = newLocation;
    this.path.addLatLng(newLocation);
    this.moveHistory.push(newLocation);

    map.panTo(newLocation);
  }

  reset(initialLocation: leaflet.latLng): void {
    this.location = initialLocation;
    this.inventory = [];
    this.moveHistory = [];
    this.path.setLatLngs([]);
  }

  collectCoin(coin: Coin): void {
    this.inventory.push(coin);
  }

  updateInventoryPanel(): void {
    const panel = document.querySelector<HTMLDivElement>("#inventoryPanel")!;

    panel.innerHTML = this.inventory
      .map((coin) => `[${coin.toString()}]`)
      .join(", ");
  }

  toJSON(): object {
    return {
      location: this.location,
      inventory: this.inventory.map((coin) => coin.toString()),
      moveHistory: this.moveHistory.map((coord) => coord.toString()),
    };
  }
}
