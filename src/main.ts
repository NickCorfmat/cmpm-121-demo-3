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

// Create the map html element
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: true,
});

const playerInventory: Coin[] = [];

interface Coin {
  serial: string;
}

interface Cache {
  cell: leaflet.latLng;
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

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number): void {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // generate random array of coins for this cache
  const coins = generateCoinsForCache(i, j);

  const cache: Cache = {
    cell: bounds.getCenter(),
    coins: coins,
  };

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => createCachePopup(cache));
}

function createCachePopup(cache: Cache): HTMLDivElement {
  // create popup
  const cachePopupDiv = document.createElement("div");
  cachePopupDiv.innerHTML = `
    <div>Cache at ${cache.cell.lat.toFixed(5)},${
    cache.cell.lng.toFixed(
      5,
    )
  } has ${cache.coins.length} coins.
  `;

  assignCollectButtons(cachePopupDiv, cache);
  appendDepositButton(cachePopupDiv, cache);

  return cachePopupDiv;
}

// --------------------- REWRITE ----------------------------
function generateCoinsForCache(i: number, j: number): Coin[] {
  const numCoins = Math.floor(luck([i, j, "coins"].toString()) * 10) + 1;
  const coins: Coin[] = [];

  for (let n = 0; n < numCoins; n++) {
    coins.push({ serial: `C-${i}-${j}-${n}` });
  }

  return coins;
}

function assignCollectButtons(popupDiv: HTMLDivElement, cache: Cache): void {
  cache.coins.forEach((coin, index) => {
    const coinDiv = document.createElement("div");
    coinDiv.innerHTML = `Coin ${
      index + 1
    } (Serial ${coin.serial})<button id="collect-${index}"    >    Collect</button>`;

    coinDiv
      .querySelector<HTMLButtonElement>(`#collect-${index}`)!
      .addEventListener("click", () => {
        collectCoin(cache, coin);
        updateInventoryPanel();
      });

    popupDiv.appendChild(coinDiv);
  });
}

function appendDepositButton(popupDiv: HTMLDivElement, cache: Cache): void {
  const depositButton = document.createElement("button");
  depositButton.innerHTML = "Deposit Coin";

  depositButton.addEventListener("click", () => {
    depositCoin(cache);
    updateInventoryPanel();
  });

  popupDiv.appendChild(depositButton);
}

function collectCoin(cache: Cache, coin: Coin): void {
  playerInventory.push(coin);
  cache.coins = cache.coins.filter((c) => c.serial !== coin.serial);
}

function depositCoin(cache: Cache): void {
  if (playerInventory.length > 0) {
    cache.coins.push(playerInventory.pop()!);
  }
}

function updateInventoryPanel(): void {
  const coinList = playerInventory.map((coin) => coin.serial).join(", ");
  inventoryPanel.innerHTML = `Inventory:  ${coinList || " "}`;
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

// // temporary fix to Vite's asset static handling. Code from akhalim, https://github.com/akhalim1/cmpm-121-demo-3/blob/main/src/main.ts
// function _resolveAssetPath(relativePath: string): string {
//   return import.meta.resolve(`../public/${relativePath}`);
// }
