export function categoryPath(category, categories) {
  const byId = new Map(categories.map((row) => [row.id, row]));
  const names = [];
  const seen = new Set();
  let current = category;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parent_id == null ? null : byId.get(current.parent_id);
  }
  return names.join(" > ");
}
