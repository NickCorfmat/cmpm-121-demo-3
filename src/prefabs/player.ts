import leaflet from "leaflet";
import { Coin } from "./cache.ts";

export interface PlayerState {
  location: leaflet.LatLng;
  inventory: Coin[];
  moveHistory: leaflet.latLng[];
}

export class Player {
  location: leaflet.LatLng;
  inventory: Coin[];
  moveHistory: leaflet.LatLng[];
  path: leaflet.Polyline;
  playerMarker: leaflet.Marker;

  constructor(initialLocation: leaflet.LatLng, map: leaflet.Map) {
    this.location = initialLocation;
    this.inventory = [];
    this.moveHistory = [initialLocation];

    this.path = leaflet
      .polyline([], {
        color: "red",
        weight: 5,
        opacity: 0.3,
      })
      .addTo(map);

    this.path.addLatLng(initialLocation);
    map.addLayer(this.path);

    this.playerMarker = leaflet.marker(initialLocation).addTo(map);
    this.playerMarker.bindPopup("Hello, fellow traveler!");
  }

  moveTo(newLocation: leaflet.LatLng, map: leaflet.Map): void {
    this.location = newLocation;
    this.path.addLatLng(newLocation);
    this.moveHistory.push(newLocation);

    map.panTo(newLocation);
    this.playerMarker.setLatLng(newLocation);
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

  toJSON(): PlayerState {
    return {
      location: this.location,
      inventory: this.inventory,
      moveHistory: this.moveHistory,
    };
  }

  fromJSON(state: PlayerState): void {
    this.location = state.location;
    this.inventory = state.inventory;
    this.moveHistory = state.moveHistory;
  }
}
