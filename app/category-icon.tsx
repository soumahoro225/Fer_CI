export const incidentCategories = [
  { value: "Voirie", label: "Voirie dégradée", position: "c1-r1" },
  { value: "Feux", label: "Feux en panne", position: "c2-r1" },
  { value: "Insécurité", label: "Insécurité", position: "c3-r1" },
  { value: "Orpaillage clandestin", label: "Orpaillage", position: "c1-r2" },
  { value: "Nuisance sonore", label: "Nuisance sonore", position: "c2-r2" },
  { value: "Ouvrage", label: "Ouvrage gâté", position: "c3-r2" },
  { value: "Bac", label: "Bac", position: "c1-r3" },
  { value: "Péage / pesage", label: "Péage en panne", position: "c2-r3" },
  { value: "Accotement", label: "Accotement", position: "c3-r3" },
  { value: "Corruption", label: "Corruption", position: "corruption" },
] as const;

const positions = new Map<string, string>(incidentCategories.map((item) => [item.value, item.position]));

export function categoryIconClass(category: string) {
  return `category-icon-${positions.get(category) ?? "c1-r1"}`;
}

export function CategoryIcon({ category, className = "" }: { category: string; className?: string }) {
  return <span className={`category-icon ${categoryIconClass(category)} ${className}`} aria-hidden="true" />;
}

export function CategoryPicker({ legend = "Catégorie du signalement" }: { legend?: string }) {
  return <fieldset className="category-picker">
    <legend>{legend}</legend>
    <div>{incidentCategories.map((item, index) => <label key={item.value}>
      <input type="radio" name="category" value={item.value} defaultChecked={index === 0} required />
      <span className="category-choice-card"><CategoryIcon category={item.value} /><span>{item.label}</span></span>
    </label>)}</div>
  </fieldset>;
}
