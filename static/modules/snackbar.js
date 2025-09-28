// =============== Snackbar ======================
const SNACKBAR_FADOUT_TIME = 1800;
let LAST_SNACKBAR_DIV = null;
let DELETE_SNACK_TIMEOUT = null;
let CLEAR_SNACK_TIMEOUT = null;

function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

function showSnackbar(snack) {
  snack.className = "show";
  CLEAR_SNACK_TIMEOUT = setTimeout(() => {
    snack.className = snack.className.replace("show", "");
  }, SNACKBAR_FADOUT_TIME);
}

function removeSnackbar() {
  if (LAST_SNACKBAR_DIV != null) {
    LAST_SNACKBAR_DIV.remove();
    LAST_SNACKBAR_DIV = null;
  }
  if (CLEAR_SNACK_TIMEOUT != null) {
    clearTimeout(CLEAR_SNACK_TIMEOUT);
    CLEAR_SNACK_TIMEOUT = null;
  }
  if (DELETE_SNACK_TIMEOUT != null) {
    clearTimeout(DELETE_SNACK_TIMEOUT);
    DELETE_SNACK_TIMEOUT = null;
  }
}

function toggleSnackbar(message) {
  removeSnackbar();
  message = capitalize(message);

  if (message !== "") {
    LAST_SNACKBAR_DIV = document.createElement("div");
    LAST_SNACKBAR_DIV.id = "snackbar";
    LAST_SNACKBAR_DIV.innerHTML = message;
    document.body.appendChild(LAST_SNACKBAR_DIV);
    showSnackbar(LAST_SNACKBAR_DIV);
    DELETE_SNACK_TIMEOUT = setTimeout(
      removeSnackbar,
      SNACKBAR_FADOUT_TIME + 1000,
    );
    return;
  }
  const snack = document.getElementById("snackbar");
  if (snack) {
    showSnackbar(snack);
  }
}

export { toggleSnackbar, capitalize };
