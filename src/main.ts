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
import { Board } from "./board.ts";

// Interfaces
export interface Cell {
  i: number;
  j: number;
}

interface Coin {
  i: number;
  j: number;
  serial: string;
}

interface Cache {
  coords: leaflet.latLng;
  coins: Coin[];
}

// Classroom location (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_DEGREES = TILE_WIDTH;
const TILE_VISIBILITY_RADIUS = 8;
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

const playerLocation = OAKES_CLASSROOM;
const playerInventory: Coin[] = [];

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

// Get player movement buttons define in index.html
const northButton = document.getElementById("north") as HTMLButtonElement;
const southButton = document.getElementById("south") as HTMLButtonElement;
const westButton = document.getElementById("west") as HTMLButtonElement;
const eastButton = document.getElementById("east") as HTMLButtonElement;

// Add event listeners to the player movement buttons
northButton.addEventListener("click", () => {
  movePlayer(1, 0);
});

southButton.addEventListener("click", () => {
  movePlayer(-1, 0);
});

westButton.addEventListener("click", () => {
  movePlayer(0, -1);
});

eastButton.addEventListener("click", () => {
  movePlayer(0, 1);
});

function movePlayer(vertical: number, horizontal: number): void {
  playerLocation.lat = playerLocation.lat + (TILE_DEGREES * vertical);
  playerLocation.lng = playerLocation.lng + (TILE_DEGREES * horizontal);

  playerMarker.setLatLng(playerLocation);
  map.panTo(playerLocation);
}

// Display the player's points
updateInventoryPanel();

// display the player's coins
function updateInventoryPanel(): void {
  const inventoryPanel = document.querySelector<HTMLDivElement>(
    "#inventoryPanel",
  )!;

  const coinList = playerInventory
    .map((coin) => `[${getCoinString(coin)}]`)
    .join(", ");
  inventoryPanel.innerHTML = `${coinList || " "}`;
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number): void {
  const cell: Cell = { i, j };
  const bounds = board.getCellBounds(cell);

  // Instantiate the cache's leaflet coordinates and coins
  const cache: Cache = {
    coords: bounds.getCenter(),
    coins: generateCoinsForCache(i, j),
  };

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

  // Assign unique id to each coin in 'i:j#serial' format
  for (let n = 0; n < numCoins; n++) {
    coins.push({ i: i, j: j, serial: `${n}` });
  }

  return coins;
}

// Return coin-bracket formatted string
function getCoinString(coin: Coin): string {
  return `${coin.i}:${coin.j}#${coin.serial}`;
}

function createCachePopup(cache: Cache): HTMLDivElement {
  // get the cache's cell
  const cell: Cell = board.getCellForPoint(cache.coords);

  // create popup
  const cachePopupDiv = document.createElement("div");
  cachePopupDiv.innerHTML = `
    <div><h3>Cache ${cell.i}, ${cell.j}</h3></div>
  `;

  appendCollectButtons(cachePopupDiv, cache);
  appendDepositButton(cachePopupDiv, cache);

  return cachePopupDiv;
}

function createCoinButton(cache: Cache, coin: Coin): HTMLDivElement {
  // create button for new coin
  const coinDiv = document.createElement("div");
  coinDiv.innerHTML = `Coin: [${
    getCoinString(coin)
  }]<button id="collect-${coin.serial}">Collect</button>`;

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

// Look around the player's neighborhood for caches to spawn
for (let x = -TILE_VISIBILITY_RADIUS; x < TILE_VISIBILITY_RADIUS; x++) {
  for (let y = -TILE_VISIBILITY_RADIUS; y < TILE_VISIBILITY_RADIUS; y++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([x, y].toString()) < CACHE_SPAWN_PROBABILITY) {
      const cell = board.getCellForPoint(OAKES_CLASSROOM);
      spawnCache(cell.i + x, cell.j + y);
    }
  }
}
