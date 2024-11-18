// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Interfaces
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";
import { Cache, Coin } from "./cache.ts";

// Classes
interface DirectionalButtonConfig {
  name: string;
  vertical: number;
  horizontal: number;
}

// Oakes classroom location (as identified on Google Maps)
const PLAYER_ORIGIN = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_DEGREES = TILE_WIDTH;
const TILE_VISIBILITY_RADIUS = 9;
const CACHE_SPAWN_PROBABILITY = 0.1;
const LOCAL_STORAGE_KEY = "GAME_STATE";

// Create Board for Cells
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);

// Create the map html element
const map = leaflet.map(document.getElementById("map")!, {
  center: PLAYER_ORIGIN,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Player variables
let playerLocation: leaflet.LatLng = PLAYER_ORIGIN;
let playerInventory: Coin[] = [];
let playerMoveHistory: leaflet.LatLng[] = [];

const playerPath: leaflet.Polyline = leaflet.polyline([], {
  color: "red",
  weight: 5,
  opacity: 0.3,
});

playerPath.addTo(map);

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

// 🌐 Automatic position updating based on device's real-world geolocation
const geolocatorButton = document.querySelector<HTMLButtonElement>("#sensor")!;

geolocatorButton.addEventListener("click", () => {
  // clear polyline and start drawing from new location
  playerPath.setLatLngs([]);

  // track changes in device's current location
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;
    const newLocation = leaflet.latLng(latitude, longitude);

    // refresh map to account for new player location
    updatePlayerLocation(newLocation);
    drawPlayerPath(newLocation);
    showNearbyCaches();

    saveGameState();
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
    resetGame();
  }
});

function resetGame(): void {
  updatePlayerLocation(PLAYER_ORIGIN);

  // reset player path
  playerMoveHistory = [];
  playerPath.setLatLngs([]);
  drawPlayerPath(PLAYER_ORIGIN); // add start position to player path history

  // return all coins from player inventory back to original caches
  playerInventory.forEach((coin) => {
    const { i, j } = coin;
    const originalCache = board.getCache(i, j);

    originalCache?.coins.push(coin);
    board.setCache(i, j, originalCache!);
  });
  playerInventory = [];

  updateInventoryPanel();

  // override local game data
  localStorage.clear();
  saveGameState();
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
    playerLocation.lat + TILE_DEGREES * deltaLat,
    playerLocation.lng + TILE_DEGREES * delatLng,
  );

  // refresh map to account for new player location
  updatePlayerLocation(newLocation);
  drawPlayerPath(newLocation);
  showNearbyCaches();

  saveGameState();
}

function updatePlayerLocation(newLocation: leaflet.LatLng): void {
  // update player location to new location
  playerLocation = newLocation;

  // update map to new player location
  playerMarker.setLatLng(newLocation);
  map.panTo(newLocation);
}

function drawPlayerPath(newLocation: leaflet.LatLng): void {
  playerMoveHistory.push(newLocation); // log new coords in player's path
  playerPath.addLatLng(newLocation); // add new point to polyline
}

// Path drawn once at game start to account for player spawn
drawPlayerPath(playerLocation);

// Display the player's coins on the inventory panel
function updateInventoryPanel(): void {
  const inventoryPanel = document.querySelector<HTMLDivElement>(
    "#inventoryPanel",
  )!;

  // display coins in [i:j:serial] format
  const coinList = playerInventory
    .map((coin) => `[${coin.toString()}]`)
    .join(", ");
  inventoryPanel.innerHTML = `${coinList || " "}`;
}

// Display the player's coins immediately at game start
updateInventoryPanel();

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

  // add event listener to the new collect button
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

  // add event listener to the new deposit button
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

  // update new cache state on board
  board.setCache(cache.i, cache.j, cache);

  // remove coin's collect button
  coinDiv.remove();

  saveGameState();
}

function depositCoin(cache: Cache, popupDiv: HTMLDivElement): void {
  if (playerInventory.length > 0) {
    // transfer coin from inventory to cache
    const depositedCoin = playerInventory.pop()!;
    cache.coins.push(depositedCoin);

    // update new cache state on board
    board.setCache(cache.i, cache.j, cache);

    // create button for new coin
    const coinDiv = createCoinButton(cache, depositedCoin);
    popupDiv.appendChild(coinDiv);

    saveGameState();
  }
}

function showNearbyCaches(): void {
  const visibleCells = board.getCellsNearPoint(playerLocation);

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

// Display nearby cells once upon game start
showNearbyCaches();

// Local storage system inspired by Mako1688, https://github.com/Mako1688/cmpm-121-demo-3/blob/main/src/main.ts
function saveGameState(): void {
  const gameState = {
    playerLocation,
    playerInventory,
    playerMoveHistory,
    caches: board.getCacheData(),
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
}

function loadGameState(): void {
  const gameState = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (gameState) {
    const state = JSON.parse(gameState);

    if (!state) return; // exit if no previous game state exists

    // initialize game parameters from previous save
    playerLocation = state.playerLocation;
    playerMoveHistory = state.playerMoveHistory;
    board.setCacheStates(state.caches);

    // convert local storage data back to Coins
    playerInventory = state.playerInventory.map(
      (coinData: { i: number; j: number; serial: string }) =>
        new Coin(coinData.i, coinData.j, coinData.serial),
    );

    // display player at previous saved state's location
    updatePlayerLocation(playerLocation);
    playerPath.setLatLngs(playerMoveHistory);
    showNearbyCaches();

    updateInventoryPanel();
  }
}

//localStorage.clear();

// Called once at start to load previous game state if one exists
loadGameState();
