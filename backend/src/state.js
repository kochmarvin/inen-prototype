// Tiny in-memory state container. Holds the latest detection plus a ring
// buffer for short-term smoothing and a longer history for the /history
// endpoint. Nothing is persisted across restarts (per project decision).

const HISTORY_LIMIT = 120;
const SMOOTHING_WINDOW = 5;

class AppState {
  constructor() {
    this.latest = null;
    this.history = [];
  }

  push(entry) {
    this.latest = entry;
    this.history.push(entry);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - HISTORY_LIMIT);
    }
  }

  getSmoothingWindow() {
    return this.history.slice(-SMOOTHING_WINDOW);
  }

  getHistory() {
    return this.history.slice();
  }
}

export const appState = new AppState();
export { SMOOTHING_WINDOW, HISTORY_LIMIT };
