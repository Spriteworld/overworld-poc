module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^phaser$': '<rootDir>/__mocks__/phaser.js',
    '^phaser3-rex-plugins(.*)$': '<rootDir>/__mocks__/phaser3-rex-plugins.js',
    '^@$': '<rootDir>/src/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@Data(.*)$': '<rootDir>/src/data$1',
    '^@Maps(.*)$': '<rootDir>/src/maps$1',
    '\\?raw$': '<rootDir>/__mocks__/rawFile.js',
    '^@Objects(.*)$': '<rootDir>/src/objects$1',
    '.*[\\/]PauseMenu\\.js$': '<rootDir>/__mocks__/PauseMenu.js',
    '.*[\\/]PokemonSprite\\.js$': '<rootDir>/__mocks__/PokemonSprite.js',
    '^@Tileset$': '<rootDir>/__mocks__/tileset.js',
    '^@Tileset/(.*)$': '<rootDir>/src/tileset/$1',
    '^@Scenes(.*)$': '<rootDir>/src/scenes$1',
    '^@Utilities(.*)$': '<rootDir>/src/utilities$1',
  },
  // Transform all files including ESM node_modules (@spriteworld/pokemon-data etc.)
  transformIgnorePatterns: [],
  roots: ['<rootDir>/src'],
};
