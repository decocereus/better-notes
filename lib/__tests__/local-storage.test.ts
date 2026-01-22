import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionStorage, LocalStorage } from "../local-storage";

// Create a fresh store for each test
let store: Record<string, string> = {};

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn((key: string) => store[key] ?? null),
	setItem: vi.fn((key: string, value: string) => {
		store[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete store[key];
	}),
	clear: vi.fn(() => {
		store = {};
	}),
};

// Mock both window and localStorage for the storage module
Object.defineProperty(global, "window", {
	value: {},
	writable: true,
});

Object.defineProperty(global, "localStorage", {
	value: localStorageMock,
	writable: true,
});

describe("LocalStorage", () => {
	beforeEach(() => {
		store = {};
		vi.clearAllMocks();
	});

	afterEach(() => {
		store = {};
	});

	describe("get", () => {
		it("returns default value when key does not exist", () => {
			const storage = new LocalStorage("test-key", "default");
			expect(storage.get()).toBe("default");
		});

		it("returns stored value when key exists", () => {
			localStorageMock.setItem("test-key", JSON.stringify("stored-value"));
			const storage = new LocalStorage("test-key", "default");
			expect(storage.get()).toBe("stored-value");
		});

		it("handles complex objects", () => {
			const obj = { name: "test", items: [1, 2, 3] };
			localStorageMock.setItem("test-key", JSON.stringify(obj));
			const storage = new LocalStorage("test-key", {});
			expect(storage.get()).toEqual(obj);
		});
	});

	describe("set", () => {
		it("stores value in localStorage", () => {
			const storage = new LocalStorage("test-key", "default");
			storage.set("new-value");
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify("new-value")
			);
		});

		it("handles complex objects", () => {
			const storage = new LocalStorage<{ name: string }>("test-key", {
				name: "",
			});
			const obj = { name: "test" };
			storage.set(obj);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify(obj)
			);
		});
	});

	describe("update", () => {
		it("updates value using updater function", () => {
			const storage = new LocalStorage("test-key", 0);
			localStorageMock.setItem("test-key", JSON.stringify(5));
			storage.update((current) => current + 1);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify(6)
			);
		});
	});

	describe("clear", () => {
		it("removes item from localStorage", () => {
			const storage = new LocalStorage("test-key", "default");
			storage.clear();
			expect(localStorageMock.removeItem).toHaveBeenCalledWith("test-key");
		});
	});

	describe("exists", () => {
		it("returns false when key does not exist", () => {
			const storage = new LocalStorage("test-key", "default");
			expect(storage.exists()).toBe(false);
		});

		it("returns true when key exists", () => {
			localStorageMock.setItem("test-key", JSON.stringify("value"));
			const storage = new LocalStorage("test-key", "default");
			expect(storage.exists()).toBe(true);
		});
	});
});

describe("CollectionStorage", () => {
	interface TestItem {
		id: string;
		name: string;
	}

	beforeEach(() => {
		store = {};
		vi.clearAllMocks();
	});

	afterEach(() => {
		store = {};
	});

	describe("getAll", () => {
		it("returns empty array when no items", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.getAll()).toEqual([]);
		});

		it("returns all stored items", () => {
			const items = [
				{ id: "1", name: "Item 1" },
				{ id: "2", name: "Item 2" },
			];
			localStorageMock.setItem("test-collection", JSON.stringify(items));
			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.getAll()).toEqual(items);
		});
	});

	describe("getById", () => {
		it("returns undefined when item not found", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.getById("nonexistent")).toBeUndefined();
		});

		it("returns item when found", () => {
			const items = [{ id: "1", name: "Item 1" }];
			localStorageMock.setItem("test-collection", JSON.stringify(items));
			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.getById("1")).toEqual({ id: "1", name: "Item 1" });
		});
	});

	describe("add", () => {
		it("adds item to collection", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			storage.add({ id: "1", name: "New Item" });

			const stored = JSON.parse(
				localStorageMock.getItem("test-collection") ?? "[]"
			);
			expect(stored).toContainEqual({ id: "1", name: "New Item" });
		});
	});

	describe("update", () => {
		it("updates existing item", () => {
			const items = [{ id: "1", name: "Original" }];
			localStorageMock.setItem("test-collection", JSON.stringify(items));

			const storage = new CollectionStorage<TestItem>("test-collection");
			const updated = storage.update("1", { name: "Updated" });

			expect(updated).toEqual({ id: "1", name: "Updated" });
		});

		it("returns undefined for nonexistent item", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			const updated = storage.update("nonexistent", { name: "Updated" });
			expect(updated).toBeUndefined();
		});
	});

	describe("remove", () => {
		it("removes existing item", () => {
			const items = [
				{ id: "1", name: "Item 1" },
				{ id: "2", name: "Item 2" },
			];
			localStorageMock.setItem("test-collection", JSON.stringify(items));

			const storage = new CollectionStorage<TestItem>("test-collection");
			const result = storage.remove("1");

			expect(result).toBe(true);
			expect(storage.getById("1")).toBeUndefined();
		});

		it("returns false for nonexistent item", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			const result = storage.remove("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("count", () => {
		it("returns 0 for empty collection", () => {
			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.count()).toBe(0);
		});

		it("returns correct count", () => {
			const items = [
				{ id: "1", name: "Item 1" },
				{ id: "2", name: "Item 2" },
			];
			localStorageMock.setItem("test-collection", JSON.stringify(items));

			const storage = new CollectionStorage<TestItem>("test-collection");
			expect(storage.count()).toBe(2);
		});
	});
});
