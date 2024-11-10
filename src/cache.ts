// Class orgnaziation structure inspired by Mako1688,
// https://github.com/Mako1688/cmpm-121-demo-3/blob/main/src/geocache.ts

// Interfaces
interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

export class Coin {
  constructor(public i: number, public j: number, public serial: string) {}

  // Return coin-bracket formatted string
  toString(): string {
    return `${this.i}:${this.j}#${this.serial}`;
  }
}

export class Cache implements Momento<string> {
  public coins: Coin[] = [];

  constructor(public i: number, public j: number) {}

  setCoins(coins: Coin[]) {
    this.coins = coins;
  }

  toMomento() {
    return JSON.stringify({
      i: this.i,
      j: this.j,
      coins: this.coins,
    });
  }

  fromMomento(momento: string) {
    const state = JSON.parse(momento);
    this.i = state.i;
    this.j = state.j;
    this.coins = state.coins;
  }
}
