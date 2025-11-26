import {
  buildPokemonList,
  fetchPokemonGenerations,
} from "./modules/pokeapi.js";

import { login, register } from "./modules/auth.js";

if (window.location.pathname.startsWith(`${window.CONTEXT_PATH}/dashboard`)) {
  fetchPokemonGenerations();
}

const originalFetch = window.fetch;
const accessId = crypto.randomUUID();

if (window.DD_RUM && window.DD_RUM.setGlobalContextProperty) {
  window.DD_RUM.setGlobalContextProperty("usr.correlation_id", accessId);
}

window.login = login;
window.register = register;
window.buildPokemonList = buildPokemonList;

window.fetch = async (...args) => {
  let [resource, config] = args;

  config = config || {};

  const baggageKey = "baggage";
  const baggageValue = "x-correlation-id=" + accessId;

  if (!config.headers) {
    config.headers = {};
  }

  let urlString = resource;
  if (resource instanceof Request) {
    urlString = resource.url;
  }

  const isInternalRequest =
    urlString.toString().startsWith("/") ||
    urlString.toString().includes("tools.kamuridesu.com") ||
    urlString.toString().includes("localhost");

  if (isInternalRequest) {
    if (config.headers instanceof Headers) {
      config.headers.set(baggageKey, baggageValue);
    } else {
      config.headers[baggageKey] = baggageValue;
    }
  }

  const response = await originalFetch(resource, config);

  return response;
};
