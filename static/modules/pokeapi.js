import { toggleSnackbar, capitalize } from "./snackbar.js";
import { getCachedPokemon, putCachedPokemon } from "./cache.js";
import { buildUrl } from "./meta.js";

const pokedex = new Pokedex.Pokedex({
  cacheImages: true,
});

function getGenerationId() {
  const paths = window.location.pathname.split("/");
  return paths[paths.length - 1];
}

function getActiveGeneration() {
  const generation = `gen-${getGenerationId()}`;
  document.getElementById(generation).childNodes[1].classList.add("active");
}

async function fetchPokemonGenerations() {
  const parent = document.getElementById("generation-list");
  let children = "";
  const generations = await pokedex.getGenerationsList();
  for (let i = 1; i <= generations.count; i++) {
    children += `<li id="gen-${i}" class="nav-item">
              <a class="nav-link" href="${window.CONTEXT_PATH}/dashboard/${i}">Generation ${i}</a>
              ${i == generations.count ? "" : "<hr>"}
            </li>`;
  }
  parent.innerHTML = children;
  getActiveGeneration();
}

function toggleCaught(pkmId, isCaught) {
  const pkmDiv = document.getElementById(pkmId);
  isCaught ? pkmDiv.classList.add("caught") : pkmDiv.classList.remove("caught");
}

async function catchPkm(pkmId) {
  const genId = getGenerationId();
  try {
    let response = await fetch(buildUrl(`${genId}/${pkmId}`), {
      method: "post",
    });
    if (!response.ok) {
      console.error(`error fetching response, status is ${response.status}`);
      const data = await response.json();
      return toggleSnackbar(data.message);
    }
    toggleCaught(pkmId, true);
  } catch (e) {}
}

async function releasePkm(pkmId) {
  const genId = getGenerationId();
  try {
    let response = await fetch(buildUrl(`${genId}/${pkmId}`), {
      method: "delete",
    });
    if (!response.ok) {
      console.error(`error fetching response, status is ${response.status}`);
      const data = await response.json();
      return toggleSnackbar(data.message);
    }
    toggleCaught(pkmId, false);
  } catch (e) {}
}

function isCaught(pkmId) {
  return document.getElementById(pkmId).classList.contains("caught");
}

async function updateCaughtPokemon(pkmId) {
  if (isCaught(pkmId)) {
    return await releasePkm(pkmId);
  }
  return await catchPkm(pkmId);
}

function addPokemonToDOM(pkm) {
  document.getElementById("pokemon-box").innerHTML +=
    `<div id="${pkm.id}" class="card pokemon-card shadow-sm ${pkm.caught ? "caught" : ""}" style="width: 10rem;">
        <div class="pokeball-status"></div>
        <img src="${pkm.img}" class="card-img-top bg-light" alt="${pkm.name}">
        <div class="card-body p-2">
          <h6 class="card-title fw-bold mb-1">${pkm.name}</h6>
        </div>
      </div>`;
}

async function loadAndDisplayPokemon(context) {
  context = context.sort((a, b) => a.id - b.id);
  const cachedPokemon = (await getCachedPokemon(getGenerationId())).sort(
    (a, b) => a.id - b.id,
  );

  const cacheMap = new Map(cachedPokemon.map((p) => [p.id, p]));

  const fullPokemonList = [];
  const newlyFetchedPokemon = [];

  for (const item of context) {
    let pkm = cacheMap.get(item.id);

    if (!pkm) {
      try {
        const freshPokemon = await pokedex.getPokemonByName(item.id);
        pkm = {
          id: freshPokemon.id,
          name: capitalize(freshPokemon.name),
          img: freshPokemon.sprites.front_default,
        };
        newlyFetchedPokemon.push(pkm);
      } catch (e) {
        const msg = (`Failed to fetch Pokémon with id: ${item.id}`, e);
        console.error(msg);
        toggleSnackbar(msg);
        continue;
      }
    }

    pkm.caught = item.caught;
    addPokemonToDOM(pkm);
    fullPokemonList.push(pkm);
  }

  if (newlyFetchedPokemon.length > 0) {
    putCachedPokemon(getGenerationId(), newlyFetchedPokemon);
  }

  return fullPokemonList.sort((a, b) => a.id - b.id);
}

function formatEvolutionDetails(details) {
  if (!details) return "<span>Special method</span>";

  const trigger = details.trigger.name.replace("-", " ");
  let condition = "";

  if (details.gender)
    condition += `${details.gender == 1 ? "fe" : ""}male only `;

  switch (details.trigger.name) {
    case "level-up":
      condition += details.min_level
        ? `at Level ${details.min_level}`
        : "by leveling up";
      if (details.known_move)
        condition += ` knowing ${details.known_move.name.replace("-", " ")}`;
      if (details.time_of_day)
        condition += ` during the ${details.time_of_day}`;
      break;
    case "use-item":
      condition += `using a ${details.item.name.replace("-", " ")}`;
      break;
    case "trade":
      condition += "by trading";
      if (details.held_item)
        condition += ` while holding a ${details.held_item.name.replace("-", " ")}`;
      break;
    default:
      condition += `by ${trigger}`;
  }

  if (details.turn_upside_down) condition += " while holding it upside down";
  if (details.needs_overworld_rain) condition += " while it's raining";
  if (details.location)
    condition += ` at ${capitalize(details.location.name.replace("-", " "))}`;
  if (details.known_move_type)
    condition += ` having learned a ${details.known_move_type.name} type move`;

  return `<span class="fw-bold">${condition}</span>`;
}

function collectPokemonName(chain) {
  let names = [chain.species.name];
  if (chain.evolves_to.length > 0) {
    chain.evolves_to.forEach((evo) => {
      names = names.concat(collectPokemonName(evo));
    });
  }
  return names;
}

function buildEvolutionHTML(chainLink, pokemonDataMap) {
  let html = "";

  chainLink.evolves_to.forEach((nextEvolution) => {
    const fromPokemon = pokemonDataMap.get(chainLink.species.name);
    const toPokemon = pokemonDataMap.get(nextEvolution.species.name);

    const fromSprite = fromPokemon.sprites.front_default;
    const toSprite = toPokemon.sprites.front_default;
    const details = nextEvolution.evolution_details[0];

    html += `
      <div class="evolution-step">
        <div class="evolution-pokemon">
          <img src="${fromSprite}" alt="${fromPokemon.name}">
          <p>${fromPokemon.name}</p>
        </div>
        <div class="evolution-method">
          <div class="evolution-arrow">→</div>
          ${formatEvolutionDetails(details)}
        </div>
        <div class="evolution-pokemon">
          <img src="${toSprite}" alt="${toPokemon.name}">
          <p>${toPokemon.name}</p>
        </div>
      </div>`;
    html += buildEvolutionHTML(nextEvolution, pokemonDataMap);
  });
  return html;
}

function displayLocationsForVersion(selectedVersion, encounterData, container) {
  let html = "";
  const locationsInVersion = encounterData.filter((loc) =>
    loc.version_details.some((vd) => vd.version.name === selectedVersion),
  );

  if (locationsInVersion.length === 0) {
    html = `<p class="locations-empty">Not found in Pokémon ${capitalize(selectedVersion)}.</p>`;
  } else {
    html = '<ul class="list-group list-group-flush">';
    locationsInVersion.forEach((location) => {
      const locationName = capitalize(
        location.location_area.name.replace(/-/g, " "),
      );
      const versionDetails = location.version_details.find(
        (vd) => vd.version.name === selectedVersion,
      );

      html += `<li class="list-group-item">
                <div class="fw-bold">${locationName}</div>`;

      versionDetails.encounter_details.forEach((detail) => {
        const method = capitalize(detail.method.name.replace(/-/g, " "));
        html += `<span class="badge bg-secondary me-1">${method} (Chance: ${detail.chance}%)</span>`;
      });
      html += `</li>`;
    });
    html += "</ul>";
  }
  container.innerHTML = html;
}

async function renderLocations(pkmId) {
  const locationContent = document.getElementById("location-content");
  try {
    const encounterData = await pokedex.getPokemonEncounterAreasByName(pkmId);

    if (encounterData.length === 0) {
      locationContent.innerHTML = `<p class="locations-empty">This Pokémon cannot be encountered in the wild.</p>`;
      return;
    }

    const versions = [
      ...new Set(
        encounterData.flatMap((loc) =>
          loc.version_details.map((vd) => vd.version.name),
        ),
      ),
    ].sort();

    locationContent.innerHTML = `
      <div class="w-100 px-md-3">
        <div class="mb-3">
          <label for="version-select" class="form-label">Select Game Version:</label>
          <select class="form-select form-select-sm" id="version-select">
            ${versions.map((v) => `<option value="${v}">${capitalize(v)}</option>`).join("")}
          </select>
        </div>
        <div id="location-list-container"></div>
      </div>`;

    const versionSelector = document.getElementById("version-select");
    const listContainer = document.getElementById("location-list-container");

    displayLocationsForVersion(
      versionSelector.value,
      encounterData,
      listContainer,
    );

    versionSelector.addEventListener("change", (e) => {
      displayLocationsForVersion(e.target.value, encounterData, listContainer);
    });
  } catch (e) {
    console.error("Failed to fetch location data: ", e);
    locationContent.innerHTML = `<p class="text-danger text-center">Could not load location data.</p>`;
  }
}

async function showPkmInfo(pkmId) {
  const infoModal = new bootstrap.Modal(
    document.getElementById("evolutionModal"),
  );
  const evolutionContent = document.getElementById("evolution-content");
  const locationContent = document.getElementById("location-content");

  const loadingSpinner = `
    <div class="text-center">
      <div class="spinner-border text-danger" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Fetching data...</p>
    </div>`;

  evolutionContent.innerHTML = loadingSpinner;
  locationContent.innerHTML = loadingSpinner;
  infoModal.show();

  try {
    const species = await pokedex.getPokemonSpeciesByName(pkmId);
    document.getElementById("evolutionModalLabel").textContent =
      `Info for ${capitalize(species.name)}`;

    const evolutionPromise = fetch(species.evolution_chain.url).then((res) => {
      if (!res.ok) throw new Error("Failed to fetch evolution data.");
      return res.json();
    });

    const [evolutionResult, _] = await Promise.allSettled([
      evolutionPromise,
      renderLocations(pkmId),
    ]);

    if (evolutionResult.status === "fulfilled") {
      const evolutionChain = evolutionResult.value;
      const pokemonNames = [
        ...new Set(collectPokemonName(evolutionChain.chain)),
      ];
      const pokemonDataPromises = pokemonNames.map((name) =>
        pokedex.getPokemonByName(name),
      );
      const pkmDataArray = await Promise.all(pokemonDataPromises);
      const pkmDataMap = new Map(pkmDataArray.map((p) => [p.name, p]));

      let html = buildEvolutionHTML(evolutionChain.chain, pkmDataMap);
      if (!html) {
        html = `<p class="text-center">This Pokémon does not evolve.</p>`;
      }
      evolutionContent.innerHTML = `<div class="w-100">${html}</div>`;
    } else {
      throw evolutionResult.reason;
    }
  } catch (e) {
    console.error("Failed to fetch data for modal: ", e);
    toggleSnackbar("Error: " + e.message);
    evolutionContent.innerHTML = `<p class="text-danger text-center">Could not load evolution data.</p>`;
  }
}

// ============== top-level initializers ==================

const pkmBox = document.getElementById("pokemon-box");

if (pkmBox !== null) {
  pkmBox.addEventListener("click", (event) => {
    const card = event.target.closest(".pokemon-card");

    if (!card) {
      return;
    }

    const pkmId = card.id;

    if (event.target.matches(".pokeball-status")) {
      return updateCaughtPokemon(pkmId);
    }
    showPkmInfo(pkmId);
  });
}

async function buildPokemonList(context) {
  await loadAndDisplayPokemon(context);
}

export { buildPokemonList, fetchPokemonGenerations };
