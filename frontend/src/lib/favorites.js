import { useEffect, useState } from "react";

const FAVORITES_KEY = "soberboardFavoriteListings";

export function getFavoriteIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setFavoriteIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids))));
  window.dispatchEvent(new Event("soberboard:favorites"));
}

export function toggleFavoriteId(id) {
  const ids = getFavoriteIds();
  const next = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
  setFavoriteIds(next);
  return next;
}

export function useFavorites() {
  const [ids, setIds] = useState(getFavoriteIds);

  useEffect(() => {
    const sync = () => setIds(getFavoriteIds());
    window.addEventListener("storage", sync);
    window.addEventListener("soberboard:favorites", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("soberboard:favorites", sync);
    };
  }, []);

  return {
    favoriteIds: ids,
    isFavorite: (id) => ids.includes(id),
    toggleFavorite: (id) => setIds(toggleFavoriteId(id)),
  };
}
