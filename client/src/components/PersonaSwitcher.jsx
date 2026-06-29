// Persona switcher — picking a persona calls ldClient.identify() in App, which
// re-evaluates every flag for that user/org context with no page reload.
export default function PersonaSwitcher({ personas, selectedId, onSelect }) {
  const selected = personas.find((p) => p.id === selectedId);
  return (
    <div className="persona-bar">
      <div className="persona-bar-inner">
        <label htmlFor="persona">Viewing as:</label>
        <select
          id="persona"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {selected && <span className="persona-blurb">{selected.blurb}</span>}
      </div>
    </div>
  );
}
