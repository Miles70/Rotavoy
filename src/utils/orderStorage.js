const STORAGE_KEY_ALIASES = {
  kemalreis_orders: "gabaloo_orders",
  kemalreis_last_order: "gabaloo_last_order",
};

const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;

function resolveStorageKey(key) {
  return STORAGE_KEY_ALIASES[String(key)] || String(key);
}

function migrateStorage(storage) {
  for (const [legacyKey, currentKey] of Object.entries(STORAGE_KEY_ALIASES)) {
    const currentValue = originalGetItem.call(storage, currentKey);
    const legacyValue = originalGetItem.call(storage, legacyKey);

    if (!currentValue && legacyValue) {
      originalSetItem.call(storage, currentKey, legacyValue);
    }

    if (legacyValue) {
      originalRemoveItem.call(storage, legacyKey);
    }
  }
}

if (!globalThis.__gabalooStorageAliasesInstalled) {
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

  globalThis.__gabalooStorageAliasesInstalled = true;
}
