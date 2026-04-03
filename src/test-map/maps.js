const MAPS = [
  {
    category: 'Random / Test',
    maps: [
      {
        scene: 'Test',
        title: 'Test',
        description: 'General-purpose test map with NPCs, overworld Pokémon, item pickups, grass encounters, and a flock system.',
        color: '#166534',
        tags: ['npcs', 'encounters', 'items', 'flock'],
        state: {
          has_pokemon:       true,
          has_cut:           false,
          has_strength:      false,
        },
      },
      {
        scene: 'Forest',
        title: 'Forest',
        description: "Dense forest map featuring a Farfetch'd NPC with complex pathfinding AI and wild Pokémon encounters.",
        color: '#14532d',
        tags: ['npcs', 'encounters', 'ai'],
        state: {
          has_pokemon:       true,
          has_cut:           false,
        },
      },
      {
        scene: 'Base',
        title: 'Base',
        description: 'Basic open-area map. Good for testing movement, collision, and general map loading.',
        color: '#374151',
        tags: ['basic'],
        state: {
          has_pokemon:       false,
        },
      },
      {
        scene: 'Skyland',
        title: 'Skyland',
        description: 'Elevated sky map. Tests multi-layer movement and alwaysTop tile rendering.',
        color: '#075985',
        tags: ['layers'],
        state: {
          has_pokemon:       false,
        },
      },
      {
        scene: 'VermillionGym',
        title: 'Vermilion Gym',
        description: 'Gym interior with puzzle-style layout. Tests indoor collision and NPC trainers.',
        color: '#7c2d12',
        tags: ['indoor', 'gym', 'puzzle'],
        state: {
          has_pokemon:       true,
        },
      },
      {
        scene: 'TurffieldGym',
        title: 'Turffield Gym',
        description: 'Grass-type gym interior. Tests curved paths and indoor warp tiles.',
        color: '#3f6212',
        tags: ['indoor', 'gym'],
        state: {
          has_pokemon:       true,
        },
      },
    ],
  },
  {
    category: 'Kanto',
    maps: [
      {
        scene: 'Kanto',
        title: 'Kanto Overworld',
        description: 'Main Kanto region overworld. Tests large maps, outdoor encounters, and multi-area navigation.',
        color: '#1e3a5f',
        tags: ['overworld', 'encounters', 'large'],
        state: {
          has_pokemon:         false,
          has_pokedex:         false,
          has_running_shoes:   false,
          has_bike:            false,
          has_cut:             false,
        },
      },
      {
        scene: 'HeroHouseF1',
        title: "Hero's House — F1",
        description: "Interior of the player's house, ground floor. Tests indoor warp to F2.",
        color: '#4c1d95',
        tags: ['indoor', 'warp'],
        state: {
          has_pokemon:       false,
        },
      },
      {
        scene: 'HeroHouseF2',
        title: "Hero's House — F2",
        description: "Interior of the player's house, second floor. Tests staircase warp return.",
        color: '#4c1d95',
        tags: ['indoor', 'warp'],
        state: {
          has_pokemon:       false,
        },
      },
      {
        scene: 'ProfessorLab',
        title: "Professor's Lab",
        description: "Professor Oak's lab interior. Tests NPC interactions and lab-to-overworld warp.",
        color: '#1e3a5f',
        tags: ['indoor', 'npcs', 'warp'],
        state: {
          has_pokemon:       false,
          has_pokedex:       false,
        },
      },
    ],
  },
];

export default MAPS;
