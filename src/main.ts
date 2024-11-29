// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Interfaces
import luck from "./luck.ts";
import { Board, Cell } from "./prefabs/board.ts";
import { Cache, Coin } from "./prefabs/cache.ts";
import { Player } from "./prefabs/player.ts";
import { GameState } from "./gamestate.ts";

// Classes
interface DirectionalButtonConfig {
  name: string;
  vertical: number;
  horizontal: number;
}

// Tunable gameplay parameters
const PLAYER_ORIGIN = leaflet.latLng(36.98949379578401, -122.06277128548504); // Oakes classroom
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_DEGREES = TILE_WIDTH;
const TILE_VISIBILITY_RADIUS = 9;
const CACHE_SPAWN_PROBABILITY = 0.1;
const LOCAL_STORAGE_KEY = "GAME_STATE";

// Create the map html element
const map = leaflet.map(document.getElementById("map")!, {
  center: PLAYER_ORIGIN,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add a tile layer to the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a player marker to the map
const playerMarker = leaflet.marker(PLAYER_ORIGIN).addTo(map);
playerMarker.bindPopup("Hello, fellow traveler!");

// Set up core gameplay elements
const player = new Player(PLAYER_ORIGIN);
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);
const gameState = new GameState(player, board, LOCAL_STORAGE_KEY);

player.path.addTo(map);
player.updateInventoryPanel();
showNearbyCaches();

// Game Logic

function showNearbyCaches(): void {
  const visibleCells = board.getCellsNearPoint(player.location);

  visibleCells.forEach((cell) => {
    // restore cache based on saved state
    const cache = board.getCache(cell.i, cell.j);

    if (cache) {
      // display regenerated cache's popup
      createCachePopup(cache);
    } else if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      // create new cache based on global spawn rate
      spawnCache(cell.i, cell.j);
    }
  });
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number): void {
  const cell: Cell = { i, j };
  const bounds = board.getCellBounds(cell);

  // instantiate the cache's coordinates and coins
  const cache: Cache = new Cache(i, j);
  cache.setCoins(generateCoinsForCache(i, j));

  // save cache state on the board using Momento Pattern
  board.setCache(i, j, cache);

  // add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // create popup representing the cache
  rect.bindPopup(() => createCachePopup(cache));
}

// Populate caches with a random amount of coins
function generateCoinsForCache(i: number, j: number): Coin[] {
  // compute pseudo-random amount (between 0 and 7) of coins per cache
  const numCoins = Math.floor(luck([i, j, "coins"].toString()) * 8);
  const coins: Coin[] = [];

  // create list of coins in 'i:j#serial' format
  for (let n = 0; n < numCoins; n++) {
    const coin = new Coin(i, j, `${n}`);
    coins.push(coin);
  }

  return coins;
}

function collectCoin(cache: Cache, coin: Coin, coinDiv: HTMLDivElement): void {
  // transfer coin to inventory and remove from cache's coin list
  player.collectCoin(coin);
  cache.coins = cache.coins.filter((c) => c.serial !== coin.serial); // Source: Brace, "How to remove a specific item from a list"

  // update new cache state on board
  board.setCache(cache.i, cache.j, cache);

  // remove coin's collect button
  coinDiv.remove();

  //saveGameState();
}

function depositCoin(cache: Cache, popupDiv: HTMLDivElement): void {
  if (player.inventory.length > 0) {
    // transfer coin from inventory to cache
    const depositedCoin = player.inventory.pop()!;
    cache.coins.push(depositedCoin);

    // update new cache state on board
    board.setCache(cache.i, cache.j, cache);

    // create button for new coin
    const coinDiv = createCoinButton(cache, depositedCoin);
    popupDiv.appendChild(coinDiv);

    //saveGameState();
  }
}

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
    player.location.lat + TILE_DEGREES * deltaLat,
    player.location.lng + TILE_DEGREES * delatLng,
  );

  player.moveTo(newLocation, map);
  playerMarker.setLatLng(newLocation);

  // refresh map to account for new player location
  showNearbyCaches();

  //saveGameState();
}

// Game Presentation

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

  // add event listener to the new deposit button
  depositButton.addEventListener("click", () => {
    depositCoin(cache, popupDiv);
    player.updateInventoryPanel();
  });

  popupDiv.appendChild(depositButton);
}

function createCoinButton(cache: Cache, coin: Coin): HTMLDivElement {
  // create button for new coin
  const coinDiv = document.createElement("div");
  coinDiv.innerHTML =
    `Coin: [${coin.toString()}]<button id="collect-${coin.serial}">Collect</button>`;

  // add event listener to the new collect button
  coinDiv
    .querySelector<HTMLButtonElement>(`#collect-${coin.serial}`)!
    .addEventListener("click", () => {
      collectCoin(cache, coin, coinDiv);
      player.updateInventoryPanel();
    });

  return coinDiv;
}

// 🌐 Automatic position updating based on device's real-world geolocation
const geolocatorButton = document.querySelector<HTMLButtonElement>("#sensor")!;

geolocatorButton.addEventListener("click", () => {
  // clear polyline and start drawing from new location
  player.path.setLatLngs([]);

  // track changes in device's current location
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;
    const newLocation = leaflet.latLng(latitude, longitude);

    // refresh map to account for new player location
    player.moveTo(newLocation, map);
    showNearbyCaches();

    //saveGameState();
  });
});

// 🚮 Reset game state and return all coins to original caches
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
resetButton.addEventListener("click", () => {
  const userInput = prompt(
    "Are you sure you want to reset game? 'yes' or 'no'",
  );

  // reset game if user confirms
  if (userInput?.toLocaleLowerCase() === "yes") {
    gameState.reset(PLAYER_ORIGIN);
  }
});

// // Called once at start to load previous game state if one exists
// //loadGameState();
