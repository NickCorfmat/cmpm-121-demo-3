// Source: refactoring help from Brace, https://chat.brace.tools/c/f8bf5397-a95e-4590-9165-c4e542d62097

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
  map: leaflet.Map;

  constructor(initialLocation: leaflet.LatLng, map: leaflet.Map) {
    this.location = initialLocation;
    this.inventory = [];
    this.moveHistory = [initialLocation];
    this.map = map;

    this.path = leaflet
      .polyline([], {
        color: "red",
        weight: 5,
        opacity: 0.3,
      })
      .addTo(map);

    this.path.addLatLng(initialLocation);
    this.map.addLayer(this.path);

    this.playerMarker = leaflet.marker(initialLocation).addTo(map);
    this.playerMarker.bindPopup("Hello, fellow traveler!");
  }

  moveTo(newLocation: leaflet.LatLng): void {
    this.location = newLocation;
    this.moveHistory.push(newLocation);
    this.path.addLatLng(newLocation);

    this.updateMarker(newLocation);
  }

  reset(initialLocation: leaflet.latLng): void {
    this.location = initialLocation;
    this.inventory = [];
    this.moveHistory = [];
    this.path.setLatLngs([]);

    this.updateInventoryPanel();
  }

  collectCoin(coin: Coin): void {
    this.inventory.push(coin);
    this.updateInventoryPanel();
  }

  depositCoin(): Coin {
    const coin = this.inventory.pop()!;
    this.updateInventoryPanel();
    return coin;
  }

  updateMarker(newLocation: leaflet.LatLng) {
    this.playerMarker.setLatLng(newLocation);
    this.map.panTo(newLocation);
  }

  updateInventoryPanel(): void {
    const panel = document.querySelector<HTMLDivElement>("#inventoryPanel")!;
    panel.innerHTML = this.inventory
      .map((coin) => "(" + coin.toString() + ")")
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
    this.moveHistory = state.moveHistory;

    this.inventory = state.inventory.map(
      (coinData: { i: number; j: number; serial: string }) =>
        new Coin(coinData.i, coinData.j, coinData.serial),
    );

    this.path.setLatLngs(this.moveHistory);
    this.updateInventoryPanel();

    const lastLocation = this.moveHistory.slice(-1)[0];
    this.updateMarker(lastLocation);
  }
}
