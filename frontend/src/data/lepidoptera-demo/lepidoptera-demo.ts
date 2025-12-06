// Re-export parsed dataset from import_sample (built from CSV)
import {
  lepidopteraSpecies,
  plantSpecies,
  parsedInteractions as interactions,
  divisions,
  buildDivisionLevel,
  buildSpeciesForDivision
} from './import_sample';

export { lepidopteraSpecies, plantSpecies, interactions, divisions, buildDivisionLevel, buildSpeciesForDivision };
