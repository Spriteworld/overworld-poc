## Intro
This is a POC Repository so things will change a lot and probably infrequently.
The aim is to replicate Gen3 Pokemon overworld mechanics and battle mechanics utilizing the Phaser Game Engine.

## Directory Structure
- src
  - data // stores game based data, configs, debug flags etc
  - maps // stores maps in .json form. Could also be a .world file that would describe to Tiled how the maps position themselves in the world
  - objects // game specific objects, characters, items, etc
  - scenes // scenes load maps, and other information to build up a scene
  - tileset // the tilesets this game has access to
    - characters // character spritesheets
    - overworld // all the overworld pokemon
    - battlescene // all the tiles related to the build up of the battlescenes
  - utilities // game specific utility functions

World Tilesets are stored in a 32 x 32 px grid.
Character/Pokemon Tilesets are variable in size.

## Building a map
Building up a map needs a few layers:
 - sky: for sky things
 - top: things that should render in front of the character, tops of buildings/trees for eg
 - ground: things that sit on the floor, furnature/buildings/signs/people etc
 - floor: the bottom most layer, the thing the character walks on

You can add any other layers in between em to build up the world.

Each Dynamic Object should have a entry in an Object Layer called `interactions` this will describe positioning and any other relevant data associated.
There are a few Classes that can be used to build up the interactions layer:
 - playerSpawn: describes where the player should spawn
 - pkmn: overworld pokemon that can be interacted with
 - npc: non playable characters / trainers / etc
 - sign: sign
 - warp: allows the player to warp internal on the maps and to other maps
 - layerTransition: allows the player to move between layers on the map
 - encounters: (NYI) will allow the area to contain wild pokemon

Each class has a collection of properties that are associated with it, which can be found in `/src/tileset/objecttypes.json`. Both Phaser and Tiled will read that file.
These properties will describe things like how the NPC should be facing when it spawns, or what pokemon should be spawned in the overworld.

## Collaborating
This is a for fun project, to better understand the pokemon games, and to try and build one myself.
Any collaborations are welcome, feel free to submit PRs or join the discord (tZeFkKK3bA)
