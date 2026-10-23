/* Preferences and observed alerts are isolated by authenticated user. */
const preferenceStore = {
  key(key) {
    return "descomplica:" + document.documentElement.dataset.storageScope + ":" + key;
  },
  getItem(key) {
    try {
      return localStorage.getItem(this.key(key));
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(this.key(key), value);
    } catch {
      /* The current view remains usable without persistence. */
    }
  },
};
