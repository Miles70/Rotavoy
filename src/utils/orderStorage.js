const CURRENT_PREFIX = "rotavoy";
const LEGACY_PREFIXES = [
  ["master", "ota"].join(""),
  ["kemal", "reis"].join(""),
];
const STORAGE_SUFFIXES = ["orders", "last_order"];

const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;

function getCurrentKey(suffix) {
  return `${CURRENT_PREFIX}_${suffix}`;
}

function resolveStorageKey(key) {
  const value = String(key);

  for (const legacyPrefix of LEGACY_PREFIXES) {
    for (const suffix of STORAGE_SUFFIXES) {
      if (value === `${legacyPrefix}_${suffix}`) {
        return getCurrentKey(suffix);
      }
    }
  }

  return value;
}

function migrateStorage(storage) {
  for (const suffix of STORAGE_SUFFIXES) {
    const currentKey = getCurrentKey(suffix);
    const currentValue = originalGetItem.call(storage, currentKey);

    for (const legacyPrefix of LEGACY_PREFIXES) {
      const legacyKey = `${legacyPrefix}_${suffix}`;
      const legacyValue = originalGetItem.call(storage, legacyKey);

      if (!currentValue && legacyValue) {
        originalSetItem.call(storage, currentKey, legacyValue);
      }

      if (legacyValue) {
        originalRemoveItem.call(storage, legacyKey);
      }
    }
  }
}

if (!globalThis.__rotavoyStorageAliasesInstalled) {
  migrateStorage(localStorage);

  Storage.prototype.getItem = function getItem(key) {
    return originalGetItem.call(this, resolveStorageKey(key));
  };

  Storage.prototype.setItem = function setItem(key, value) {
    const resolvedKey = resolveStorageKey(key);
    originalSetItem.call(this, resolvedKey, value);

    if (resolvedKey !== String(key)) {
      originalRemoveItem.call(this, String(key));
    }
  };

  Storage.prototype.removeItem = function removeItem(key) {
    const resolvedKey = resolveStorageKey(key);
    originalRemoveItem.call(this, resolvedKey);

    if (resolvedKey !== String(key)) {
      originalRemoveItem.call(this, String(key));
    }
  };

  globalThis.__rotavoyStorageAliasesInstalled = true;
}
