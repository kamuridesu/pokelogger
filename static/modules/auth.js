import { buildUrl } from "./meta.js";
import { toggleSnackbar } from "./snackbar.js";

// =================== Auth =======================
async function login__register(path) {
  if (window.location.pathname != `${window.CONTEXT_PATH}/${path}`) {
    return toggleSnackbar("Location now allowed");
  }

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (!usernameInput || !passwordInput) {
    return toggleSnackbar("Username or passsword empty");
  }

  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    let response = await fetch(buildUrl(path), {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });
    if (!response.ok) {
      console.error(`error fetching response, status is ${response.status}`);
      const data = await response.json();
      return toggleSnackbar(data.message);
    }
    toggleSnackbar((await response.json()).message);
    setTimeout(() => {
      window.location.replace(
        buildUrl(path == "register" ? "login" : "dashboard/1"),
      );
    }, 1000);
  } catch (e) {
    console.error(e);
    toggleSnackbar("Error while processing request, try again.");
  }
}

async function login(event) {
  if (event != undefined) {
    event.preventDefault();
  }
  return await login__register("login");
}

async function register(event) {
  if (event != undefined) {
    event.preventDefault();
  }
  return await login__register("register");
}

document.addEventListener("submit", (_) => {});

export { login, register };
