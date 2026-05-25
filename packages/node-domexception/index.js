// Custom node-domexception replacement that avoids deprecation logs
// Under Node 18+, DOMException is built into the global scope.

if (!globalThis.DOMException) {
  // Fallback fallback class if not natively available
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = "The operation was aborted.", name = "AbortError") {
      super(message);
      this.name = name;
    }
  };
}

module.exports = globalThis.DOMException;
