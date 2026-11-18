// Carga la lista de tattoos desde config/tattoos.json
export async function loadTattoos() {
  const res = await fetch('config/tattoos.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('No se pudo cargar config/tattoos.json');
  const data = await res.json();
  return data.tattoos || [];
}

export async function getTattoo(id) {
  const list = await loadTattoos();
  return list.find((t) => t.id === id) || list[0];
}
