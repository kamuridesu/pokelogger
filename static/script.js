import {
  buildPokemonList,
  fetchPokemonGenerations,
} from "./modules/pokeapi.js";

import { login, register } from "./modules/auth.js";

if (window.location.pathname.startsWith(`${window.CONTEXT_PATH}/dashboard`)) {
  fetchPokemonGenerations();
}

window.login = login;
window.register = register;
window.buildPokemonList = buildPokemonList;
