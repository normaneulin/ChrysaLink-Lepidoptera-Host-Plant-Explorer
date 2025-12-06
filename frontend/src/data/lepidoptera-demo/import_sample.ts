// Parser for sample_relationship_data.csv embedded here as a string
const csv = `id,lep_division,lep_family,lep_genus,lep_specific_epithet,plant_division,plant_family,plant_genus,plant_specific_epithet,hosts_id
820,Heterocera,Arctiidae,Arctia,caja,Angiosperm,Urticaceae,Urtica,dioica,820
6999,Heterocera,Geometridae,Anisodes,gigantula,Gymnosperm,Podocarpaceae,Podocarpus,lambertii,13724
12162,Heterocera,Geometridae,Gueneria,similaria,Pteridophyte,Thelypteridaceae,Thelypteris,noveboracensis,18887
79987,Rhopalocera,Nymphalidae,Catacroptera,cloanthe,Angiosperm,Acanthaceae,Ruellia,itogoensis,79987
96387,Rhopalocera,Pieridae,Hebomoia,glaucippe,Angiosperm,Capparaceae,Crateva,magna,96387
92017,Rhopalocera,Papilionidae,Allancastria,cerisy,Angiosperm,Aristolochiaceae,Aristolochia,clematitis,92017
,Rhopalocera,,,,,,,,
,Heterocera,,,,,,,,
,,Arctiidae,,,,,,,
,,Geometridae,,,,,,,
,,Nymphalidae,,,,,,,
,,Pieridae,,,,,,,
,,Papilionidae,,,,,,,
,,,Arctia,,,,,,,
,,,Anisodes,,,,,,,
,,,Gueneria,,,,,,,
,,,Catacroptera,,,,,,,
,,,Hebomoia,,,,,,,
,,,Allancastria,,,,,,,
,,,,,Angiosperm,,,,
,,,,,Gymnosperm,,,,
,,,,,Pteridophyte,,,,
,,,,,,Urticaceae,,,
,,,,,,Podocarpaceae,,,
,,,,,,Thelypteridaceae,,,
,,,,,,Acanthaceae,,,
,,,,,,Capparaceae,,,
,,,,,,Aristolochiaceae,,,
,,,,,,,Urtica,,
,,,,,,,Podocarpus,,
,,,,,,,Thelypteris,,
,,,,,,,Ruellia,,
,,,,,,,Crateva,,
,,,,,,,Aristolochia,,
`;

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj: any = {};
    header.forEach((h, i) => {
      obj[h] = (parts[i] ?? '').trim() || '';
    });
    return obj;
  });
  return rows;
}

const rows = parseCSV(csv);

// Collect taxa
const lepDivisions = new Set<string>();
const plantDivisions = new Set<string>();
const lepFamilies = new Set<string>();
const plantFamilies = new Set<string>();
const lepGenera = new Set<string>();
const plantGenera = new Set<string>();

const interactions: { id: string; insect: string; plant: string }[] = [];

rows.forEach((r, idx) => {
  const lepDiv = r['lep_division'];
  const lepFam = r['lep_family'];
  const lepGen = r['lep_genus'];
  const lepSpec = r['lep_specific_epithet'];
  const plantDiv = r['plant_division'];
  const plantFam = r['plant_family'];
  const plantGen = r['plant_genus'];
  const plantSpec = r['plant_specific_epithet'];

  if (lepDiv) lepDivisions.add(lepDiv);
  if (plantDiv) plantDivisions.add(plantDiv);
  if (lepFam) lepFamilies.add(lepFam);
  if (plantFam) plantFamilies.add(plantFam);
  if (lepGen) lepGenera.add(lepGen);
  if (plantGen) plantGenera.add(plantGen);

  // species interaction if both genus and specific epithet available on both sides
  if (lepGen && lepSpec && plantGen && plantSpec) {
    const insectId = `lep:${lepGen} ${lepSpec}`;
    const plantId = `plant:${plantGen} ${plantSpec}`;
    interactions.push({ id: r['id'] || `i${idx}`, insect: insectId, plant: plantId });
  }
});

// Build node lists
export const lepidopteraSpecies = Array.from(interactions.reduce((acc, rel) => {
  acc.add(rel.insect);
  return acc;
}, new Set<string>())).map(id => {
  const [_, rest] = id.split(':');
  const [genus, ...sp] = rest.split(' ');
  const species = sp.join(' ');
  // find a representative row to extract family/division
  const row = rows.find(r => r['lep_genus'] === genus && r['lep_specific_epithet'] === species);
  return {
    id,
    label: rest,
    data: {
      type: 'lepidoptera',
      division: row?.['lep_division'] || '',
      family: row?.['lep_family'] || '',
      genus: genus,
      species: rest
    }
  };
});

export const plantSpecies = Array.from(interactions.reduce((acc, rel) => {
  acc.add(rel.plant);
  return acc;
}, new Set<string>())).map(id => {
  const [_, rest] = id.split(':');
  const [genus, ...sp] = rest.split(' ');
  const species = sp.join(' ');
  const row = rows.find(r => r['plant_genus'] === genus && r['plant_specific_epithet'] === species);
  return {
    id,
    label: rest,
    data: {
      type: 'plant',
      division: row?.['plant_division'] || '',
      family: row?.['plant_family'] || '',
      genus: genus,
      species: rest
    }
  };
});

export { interactions as parsedInteractions };

export const divisions = {
  lepidoptera: Array.from(lepDivisions),
  plants: Array.from(plantDivisions)
};

// Build division-level graph
export function buildDivisionLevel() {
  const lepNodes = divisions.lepidoptera.map(d => ({ id: `lepdiv:${d}`, label: d, data: { type: 'lepidoptera', division: d }, cluster: d }));
  const plantNodes = divisions.plants.map(d => ({ id: `plantdiv:${d}`, label: d, data: { type: 'plant', division: d }, cluster: d }));

  const edgesMap = new Map<string, any>();
  interactions.forEach(rel => {
    const insectRow = lepidopteraSpecies.find(s => s.id === rel.insect);
    const plantRow = plantSpecies.find(s => s.id === rel.plant);
    if (!insectRow || !plantRow) return;
    const from = `lepdiv:${insectRow.data.division}`;
    const to = `plantdiv:${plantRow.data.division}`;
    const key = `${from}->${to}`;
    if (!edgesMap.has(key)) edgesMap.set(key, { id: `edge:${edgesMap.size}-${from}-${to}`, source: from, target: to, label: 'has host in' });
  });

  return {
    nodes: [...lepNodes, ...plantNodes],
    edges: Array.from(edgesMap.values())
  };
}

// Build species under a given division
export function buildSpeciesForDivision(divisionType: 'lepidoptera' | 'plants', divisionName: string) {
  if (divisionType === 'lepidoptera') {
    const nodes = lepidopteraSpecies.filter(s => s.data.division === divisionName).map(s => ({ ...s, cluster: s.data.family }));
    const edges = interactions
      .filter(i => nodes.some(n => n.id === i.insect))
      .map((i, idx) => ({ id: `edge-spec-${idx}-${i.insect}-${i.plant}`, source: i.insect, target: i.plant, label: 'host' }));
    return { nodes, edges };
  } else {
    const nodes = plantSpecies.filter(s => s.data.division === divisionName).map(s => ({ ...s, cluster: s.data.family }));
    const edges = interactions
      .filter(i => nodes.some(n => n.id === i.plant))
      .map((i, idx) => ({ id: `edge-spec-p-${idx}-${i.insect}-${i.plant}`, source: i.insect, target: i.plant, label: 'host' }));
    return { nodes, edges };
  }
}

// Build indexes for hierarchical drill-down
const speciesMetaMap = new Map<string, any>();
rows.forEach(r => {
  if (r['lep_genus'] && r['lep_specific_epithet']) {
    const id = `lep:${r['lep_genus']} ${r['lep_specific_epithet']}`;
    speciesMetaMap.set(id, {
      division: r['lep_division'] || '',
      family: r['lep_family'] || '',
      genus: r['lep_genus'] || '',
      species: `${r['lep_genus']} ${r['lep_specific_epithet']}`
    });
  }
  if (r['plant_genus'] && r['plant_specific_epithet']) {
    const id = `plant:${r['plant_genus']} ${r['plant_specific_epithet']}`;
    speciesMetaMap.set(id, {
      division: r['plant_division'] || '',
      family: r['plant_family'] || '',
      genus: r['plant_genus'] || '',
      species: `${r['plant_genus']} ${r['plant_specific_epithet']}`
    });
  }
});

// helpers to get unique taxa lists
function uniqueSetToArrayMap(set: Set<string>) { return Array.from(set); }

export function getNodesFor(level: 'Division' | 'Family' | 'Genus' | 'Species', side: 'lepidoptera' | 'plants', parent?: string) {
  // return nodes appropriate for requested level and optional parent filter
  if (level === 'Division') {
    const arr = side === 'lepidoptera' ? uniqueSetToArrayMap(lepDivisions) : uniqueSetToArrayMap(plantDivisions);
    return arr.map(d => ({ id: `${side === 'lepidoptera' ? 'lepdiv' : 'plantdiv'}:${d}`, label: d, data: { type: side, division: d } }));
  }

  if (level === 'Family') {
    // families filtered by parent division if provided
    const families = new Set<string>();
    rows.forEach(r => {
      const div = side === 'lepidoptera' ? r['lep_division'] : r['plant_division'];
      const fam = side === 'lepidoptera' ? r['lep_family'] : r['plant_family'];
      if (!fam) return;
      if (!parent || parent === div) families.add(fam);
    });
    return Array.from(families).map(f => ({ id: `${side === 'lepidoptera' ? 'lepfam' : 'plantfam'}:${f}`, label: f, data: { type: side, family: f, division: parent || '' } }));
  }

  if (level === 'Genus') {
    const genera = new Set<string>();
    rows.forEach(r => {
      const fam = side === 'lepidoptera' ? r['lep_family'] : r['plant_family'];
      const gen = side === 'lepidoptera' ? r['lep_genus'] : r['plant_genus'];
      if (!gen) return;
      if (!parent || parent === fam) genera.add(gen);
    });
    return Array.from(genera).map(g => ({ id: `${side === 'lepidoptera' ? 'lepgen' : 'plantgen'}:${g}`, label: g, data: { type: side, genus: g, family: parent || '' } }));
  }

  // Species
  const species = (side === 'lepidoptera' ? lepidopteraSpecies : plantSpecies).filter(s => {
    if (!parent) return true;
    // parent could be genus/family/division; check membership
    return s.data.genus === parent || s.data.family === parent || s.data.division === parent;
  });
  return species.map(s => ({ id: s.id, label: s.label, data: s.data }));
}

// Build edges between two sets of nodes at arbitrary taxonomic levels
export function buildEdgesBetween(leftLevel: 'Division' | 'Family' | 'Genus' | 'Species', leftSide: 'lepidoptera' | 'plants', leftParent: string | undefined, rightLevel: 'Division' | 'Family' | 'Genus' | 'Species', rightSide: 'lepidoptera' | 'plants', rightParent: string | undefined) {
  // get left nodes and right nodes
  const leftNodes = getNodesFor(leftLevel, leftSide, leftParent);
  const rightNodes = getNodesFor(rightLevel, rightSide, rightParent);

  // function to map species id to a node id at given level
  function mapSpeciesToNodeId(speciesId: string, level: string, side: string) {
    const meta = speciesMetaMap.get(speciesId);
    if (!meta) return null;
    if (level === 'Division') return `${side === 'lepidoptera' ? 'lepdiv' : 'plantdiv'}:${meta.division}`;
    if (level === 'Family') return `${side === 'lepidoptera' ? 'lepfam' : 'plantfam'}:${meta.family}`;
    if (level === 'Genus') return `${side === 'lepidoptera' ? 'lepgen' : 'plantgen'}:${meta.genus}`;
    return speciesId; // species
  }

  const edgesMap = new Map<string, any>();
  interactions.forEach((rel, idx) => {
    const leftSpeciesId = leftSide === 'lepidoptera' ? rel.insect : rel.plant;
    const rightSpeciesId = rightSide === 'lepidoptera' ? rel.insect : rel.plant;
    const leftNodeId = mapSpeciesToNodeId(leftSpeciesId, leftLevel, leftSide);
    const rightNodeId = mapSpeciesToNodeId(rightSpeciesId, rightLevel, rightSide);
    if (!leftNodeId || !rightNodeId) return;

    // respect parent filters if provided
    if (leftParent) {
      // leftParent may be a division/family/genus name; ensure mapping matches
      const meta = speciesMetaMap.get(leftSpeciesId);
      if (!(meta.division === leftParent || meta.family === leftParent || meta.genus === leftParent)) return;
    }
    if (rightParent) {
      const meta = speciesMetaMap.get(rightSpeciesId);
      if (!(meta.division === rightParent || meta.family === rightParent || meta.genus === rightParent)) return;
    }

    const key = `${leftNodeId}->${rightNodeId}`;
    if (!edgesMap.has(key)) edgesMap.set(key, { id: `edge:${edgesMap.size}-${leftNodeId}-${rightNodeId}`, source: leftNodeId, target: rightNodeId, label: 'host' });
  });

  return Array.from(edgesMap.values());
}
