# Atlas Recall

Atlas Recall is a geography game built with React, TypeScript, and Vite.

Click a country on the map, type its name, and try to finish the world with as few mistakes as possible. The game saves progress locally in the browser.

## Gameplay

The game is about naming countries from the map itself.

- Click or tap a country to select it.
- Type the country name into the search field.
- Submit the answer.
- Correct answers mark that country as solved.
- Incorrect answers count as mistakes and move play forward.

The run continues until you submit it or finish the full map.

The game keeps track of:

- solved countries
- remaining countries
- wrong answers
- elapsed time
- best completed run

Desktop and mobile use different interfaces, but the core loop is the same:

- desktop has a larger HUD and map controls
- mobile uses a bottom search dock and touch gestures

Your progress is stored in `localStorage`, so refreshing the page should preserve an in-progress run.

## Run It

```bash
npm install
npm run dev
```

Use a specific port if needed:

```bash
npm run dev -- --port 4175
```

## Other Commands

```bash
npm test
npm run build
npm run generate:data
```

## Main Files

- App: [`/Users/chrismacpherson/Desktop/game2/src/app/App.tsx`](/Users/chrismacpherson/Desktop/game2/src/app/App.tsx)
- Map: [`/Users/chrismacpherson/Desktop/game2/src/features/map/WorldMap.tsx`](/Users/chrismacpherson/Desktop/game2/src/features/map/WorldMap.tsx)
- Camera logic: [`/Users/chrismacpherson/Desktop/game2/src/features/map/mapGeometry.ts`](/Users/chrismacpherson/Desktop/game2/src/features/map/mapGeometry.ts)
- Game state: [`/Users/chrismacpherson/Desktop/game2/src/features/game/gameReducer.ts`](/Users/chrismacpherson/Desktop/game2/src/features/game/gameReducer.ts)
- Persistence: [`/Users/chrismacpherson/Desktop/game2/src/lib/storage.ts`](/Users/chrismacpherson/Desktop/game2/src/lib/storage.ts)
