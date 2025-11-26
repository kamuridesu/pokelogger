import {
  buildPokemonList,
  fetchPokemonGenerations,
} from "./modules/pokeapi.js";

import { login, register } from "./modules/auth.js";
import { buildUrl } from "./modules/meta.js";

if (window.location.pathname.startsWith(`${window.CONTEXT_PATH}/dashboard`)) {
  fetchPokemonGenerations();
}

const accessId = crypto.randomUUID();

if (window.DD_RUM && window.DD_RUM.setGlobalContextProperty) {
  window.DD_RUM.setGlobalContextProperty("usr.correlation_id", accessId);
}

window.login = login;
window.register = register;
window.buildPokemonList = buildPokemonList;

(async () => {
  const elem = document.createElement("a");
  elem.innerHTML = "<button>test</button>";
  elem.onclick = async () => {
    const resp = await fetch(buildUrl("test"));
    console.log(await resp.text());
  };
  document.getElementsByTagName("nav")[0].appendChild(elem);
})();
