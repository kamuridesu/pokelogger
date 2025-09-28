import { buildUrl } from "./meta.js";
import { toggleSnackbar } from "./snackbar.js";

// ================== Cache control ====================
async function getCachedPokemon(genId) {
  try {
    let response = await fetch(buildUrl(`cache/${genId}`));
    if (!response.ok) {
      console.error(`error fetching response, status is ${response.status}`);
      const data = await response.json();
      return toggleSnackbar(data.message);
    }
    return await response.json();
  } catch (e) {
    console.error(e);
    toggleSnackbar("failed to fetch pokemon cache data: " + e);
    return [];
  }
}

async function putCachedPokemon(genId, pokemonList) {
  try {
    let response = await fetch(buildUrl(`cache/${genId}`), {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pokemonList),
    });
    if (!response.ok) {
      console.error(`error fetching response, status is ${response.status}`);
      const data = await response.json();
      return toggleSnackbar(data.message);
    }
  } catch (e) {
    console.error(e);
    toggleSnackbar("Error while processing request, try again.");
  }
}

export { putCachedPokemon, getCachedPokemon };
