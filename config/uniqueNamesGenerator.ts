import {
  adjectives,
  animals,
  colors,
  Config,
  NumberDictionary,
} from "unique-names-generator";

const numberDictionary = NumberDictionary.generate({ min: 100, max: 999 });

export const seedConfig: Config = {
  dictionaries: [adjectives, animals, numberDictionary],
  separator: "-",
  length: 3,
};

export const nameConfig: Config = {
  dictionaries: [colors, animals],
  separator: " ",
  style: "capital",
  length: 2,
};
