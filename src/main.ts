import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Classroom location (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const COORD_PRECISION = 5;

// Create the map html element
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

const playerInventory: Coin[] = [];

interface Cell {
  i: number;
  j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

interface Cache {
  coords: leaflet.latLng;
  coins: Coin[];
}

// Add a tile layer to the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a player marker to the map
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindPopup("Hello, fellow traveler!");
playerMarker.addTo(map);

// Display the player's points
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;
updateInventoryPanel();

// display the player's coins
function updateInventoryPanel(): void {
  const coinList = playerInventory
    .map((coin) => getCoinString(coin))
    .join(", ");
  inventoryPanel.innerHTML = `${coinList || " "}`;
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number): void {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const cache: Cache = {
    coords: bounds.getCenter(),
    coins: generateCoinsForCache(i, j),
  };

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => createCachePopup(cache));
}

// Populate caches with a random amount of coins
function generateCoinsForCache(i: number, j: number): Coin[] {
  const numCoins = Math.floor(luck([i, j, "coins"].toString()) * 8);
  const coins: Coin[] = [];

  for (let n = 0; n < numCoins; n++) {
    coins.push({ cell: { i: i, j: j }, serial: `${n}` });
  }

  return coins;
}

// Return coin-bracket formatted string
function getCoinString(coin: Coin): string {
  return `[${coin.cell.i}:${coin.cell.j}#${coin.serial}]`;
}

function createCachePopup(cache: Cache): HTMLDivElement {
  // create popup
  const cachePopupDiv = document.createElement("div");
  cachePopupDiv.innerHTML = `
    <div><h3>Cache ${
    cache.coords.lat.toFixed(
      COORD_PRECISION,
    )
  }, ${cache.coords.lng.toFixed(COORD_PRECISION)}</h3></div>
  `;

  appendCollectButtons(cachePopupDiv, cache);
  appendDepositButton(cachePopupDiv, cache);

  return cachePopupDiv;
}

function createCoinButton(cache: Cache, coin: Coin): HTMLDivElement {
  // create button for new coin
  const coinDiv = document.createElement("div");
  coinDiv.innerHTML = `Coin: ${
    getCoinString(coin)
  }<button id="collect-${coin.serial}">Collect</button>`;

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
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
