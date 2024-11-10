import leaflet from "leaflet";

// Class orgnaziation structure inspired by Mako1688,
// https://github.com/Mako1688/cmpm-121-demo-3/blob/main/src/geocache.ts

// Interfaces
interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

export interface Coin {
  i: number;
  j: number;
  serial: string;
}

export class Cache implements Momento<string> {
  coords: leaflet.latLng;
  coins: Coin[];

  constructor(coords: leaflet.latLng, coins: Coin[]) {
    this.coords = coords;
    this.coins = coins;
  }

  toMomento() {
    return JSON.stringify({
      coords: { lat: this.coords.lat, lng: this.coords.lng },
      coins: this.coins,
    });
  }

  fromMomento(momento: string) {
    const state = JSON.parse(momento);
    this.coords = leaflet.latLng(state.coords.lat, state.coords.lng);
    this.coins = state.coins;
  }
}
