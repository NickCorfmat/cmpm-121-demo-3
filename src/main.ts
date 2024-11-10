import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Grid cell flyweight factory
import "./board.ts";
import { Board, Cell } from "./board.ts";

// Interfaces
import { Cache, Coin } from "./cache.ts";

interface DirectionalButtonConfig {
  name: string;
  vertical: number;
  horizontal: number;
}

// Classroom location (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_DEGREES = TILE_WIDTH;
const TILE_VISIBILITY_RADIUS = 10;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create Board for Cells
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);

// Create the map html element
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Player variables
let playerLocation: leaflet.latLng = OAKES_CLASSROOM;

const playerInventory: Coin[] = [];
const playerMoveHistory: leaflet.latLng[] = [];

const playerPolyline: leaflet.polyline = leaflet.polyline(playerMoveHistory, {
  color: "red",
  weight: 5,
  opacity: 0.3,
});

playerPolyline.addTo(map);

// Add a tile layer to the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a player marker to the map
const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map);
playerMarker.bindPopup("Hello, fellow traveler!");

// Initialize player movement buttons defined in index.html
const directionConfigs: DirectionalButtonConfig[] = [
  { name: "north", vertical: 1, horizontal: 0 },
  { name: "south", vertical: -1, horizontal: 0 },
  { name: "west", vertical: 0, horizontal: -1 },
  { name: "east", vertical: 0, horizontal: 1 },
];

// Create player movement button and attach event listener
// Source: Original movement code by me, simplified with the help of Brace.
directionConfigs.forEach(({ name, vertical, horizontal }) => {
  const button = document.querySelector<HTMLButtonElement>(`#${name}`)!;

  button.addEventListener("click", () => {
    movePlayer(vertical, horizontal);
  });
});

function movePlayer(deltaLat: number, delatLng: number): void {
  const newLocation = leaflet.latLng(
    playerLocation.lat + TILE_DEGREES * deltaLat,
    playerLocation.lng + TILE_DEGREES * delatLng,
  );

  // update player location to new location
  playerLocation = newLocation;

  // update map to new player location
  playerMarker.setLatLng(newLocation);
  map.panTo(newLocation);

  updatePlayerMoveHistory(newLocation);
  showNearbyCaches();
}

function updatePlayerMoveHistory(newLocation: leaflet.latLng): void {
  playerPolyline.addLatLng(newLocation); // add new point to polyline
}

// update polyline with initial player location
updatePlayerMoveHistory(playerLocation);

// display the player's coins
function updateInventoryPanel(): void {
  const inventoryPanel = document.querySelector<HTMLDivElement>(
    "#inventoryPanel",
  )!;

  const coinList = playerInventory
    .map((coin) => `[${coin.toString()}]`)
    .join(", ");
  inventoryPanel.innerHTML = `${coinList || " "}`;
}

// Display the player's coins
updateInventoryPanel();

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number): void {
  const cell: Cell = { i, j };
  const bounds = board.getCellBounds(cell);

  // Instantiate the cache's coordinates and coins
  const cache: Cache = new Cache(i, j);
  cache.setCoins(generateCoinsForCache(i, j));

  // Save cache state on the board using Momento Pattern
  board.setCache(i, j, cache);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Create popup representing the cache
  rect.bindPopup(() => createCachePopup(cache));
}

// Populate caches with a random amount of coins
function generateCoinsForCache(i: number, j: number): Coin[] {
  // Compute pseudo-random amount (between 0 and 7) of coins per cache
  const numCoins = Math.floor(luck([i, j, "coins"].toString()) * 8);
  const coins: Coin[] = [];

  // Create list of coins in 'i:j#serial' format
  for (let n = 0; n < numCoins; n++) {
    const coin = new Coin(i, j, `${n}`);
    coins.push(coin);
  }

  return coins;
}

function createCachePopup(cache: Cache): HTMLDivElement {
  // create popup
  const cachePopupDiv = document.createElement("div");
  cachePopupDiv.innerHTML = `
    <div><h3>Cache ${cache.i}, ${cache.j}</h3></div>
  `;

  appendCollectButtons(cachePopupDiv, cache);
  appendDepositButton(cachePopupDiv, cache);

  return cachePopupDiv;
}

function createCoinButton(cache: Cache, coin: Coin): HTMLDivElement {
  // create button for new coin
  const coinDiv = document.createElement("div");
  coinDiv.innerHTML =
    `Coin: [${coin.toString()}]<button id="collect-${coin.serial}">Collect</button>`;

  // Add event listener to the new collect button
  coinDiv
    .querySelector<HTMLButtonElement>(`#collect-${coin.serial}`)!
    .addEventListener("click", () => {
      collectCoin(cache, coin, coinDiv);
      updateInventoryPanel();
    });

  return coinDiv;
}

function appendCollectButtons(popupDiv: HTMLDivElement, cache: Cache): void {
  // create a collect button for each coin in the cache
  cache.coins.forEach((coin) => {
    const coinDiv = createCoinButton(cache, coin);
    popupDiv.appendChild(coinDiv);
  });
}

function appendDepositButton(popupDiv: HTMLDivElement, cache: Cache): void {
  // create deposit button
  const depositButton = document.createElement("button");
  depositButton.innerHTML = "Deposit Coin";

  // Add event listener to the new deposit button
  depositButton.addEventListener("click", () => {
    depositCoin(cache, popupDiv);
    updateInventoryPanel();
  });

  popupDiv.appendChild(depositButton);
}

function collectCoin(cache: Cache, coin: Coin, coinDiv: HTMLDivElement): void {
  // transfer coin to inventory and remove from cache's coin list
  playerInventory.push(coin);
  cache.coins = cache.coins.filter((c) => c.serial !== coin.serial); // Source: Brace, "How to remove a specific item from a list"

  // remove coin's collect button
  coinDiv.remove();
}

function depositCoin(cache: Cache, popupDiv: HTMLDivElement): void {
  if (playerInventory.length > 0) {
    // transfer coin from inventory to cache
    const depositedCoin = playerInventory.pop()!;
    cache.coins.push(depositedCoin);

    // create button for new coin
    const coinDiv = createCoinButton(cache, depositedCoin);
    popupDiv.appendChild(coinDiv);
  }
}

function showNearbyCaches(): void {
  const visibleCells = board.getCellsNearPoint(playerLocation);

  visibleCells.forEach((cell) => {
    // Restore cache based on saved state
    const cache = board.getCache(cell.i, cell.j);

    if (cache) {
      // Display regenerated cache's popup
      createCachePopup(cache);
    } else if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      // Create new cache based on global spawn rate
      spawnCache(cell.i, cell.j);
    }
  });
}

// Display nearby cells once upon game start
showNearbyCaches();

// Persistent data storage using cookies
// Code modified from https://gist.github.com/joduplessis/7b3b4340353760e945f972a69e855d11
// function setCookie(name: string, value: string): void {
//   const date = new Date();

//   // Set cookie expiration date
//   date.setTime(date.getTime() + 7 * 24 * 60 * 60 * 1000);

//   document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
// }

// function getCookie(name: string): string {
//   const value = "; " + document.cookie;
//   const parts = value.split("; " + name + "=");

//   if (parts.length == 2) {
//     return parts.pop()!.split(";").shift();
//   }
// }
