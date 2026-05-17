import { db } from '../src/db.js';

const TALKS = [
  {
    title: 'Knife Skills for the Home Cook',
    speaker_name: 'Mira Kestrel',
    abstract:
      'A practical walkthrough of grips, cuts, and sharpening. We will cover the pinch grip, rocking and push cuts, and how to maintain a working edge without specialty equipment. Bring an onion (mentally).',
  },
  {
    title: 'Trail Planning for Day Hikes',
    speaker_name: 'Owen Holloway',
    abstract:
      'How to read topographic maps, estimate pace, plan water and bailouts, and pack light without skipping the essentials. Includes a simple template for trip plans you can share with a friend before heading out.',
  },
  {
    title: 'Light, Composition, and Patience',
    speaker_name: 'Nadia Park',
    abstract:
      'A friendly tour of natural light and framing for photographers using any camera, including phones. We will talk about golden hour, leading lines, negative space, and the underrated skill of just waiting for the moment.',
  },
  {
    title: 'Designing a Board Game Night',
    speaker_name: 'Felix Drummond',
    abstract:
      'From player counts and table flow to picking openers, headliners, and palate cleansers. A repeatable framework for hosting a board game evening that works for new players and seasoned hobbyists alike.',
  },
  {
    title: 'Container Gardening on a Balcony',
    speaker_name: 'Priya Vasquez',
    abstract:
      'Choosing pots, soil mixes, and plants that thrive in small outdoor spaces. We will cover sun mapping, watering routines, simple companions like basil and tomato, and how to keep things alive while traveling.',
  },
  {
    title: 'Your First Woodworking Project',
    speaker_name: 'Henrik Salo',
    abstract:
      'A small bookshelf, end to end, using a saw, a drill, sandpaper, and patience. We will discuss wood choice, basic joinery, finishing options, and how to recover from the mistakes you will absolutely make.',
  },
  {
    title: 'A Beginner Tour of the Night Sky',
    speaker_name: 'Yuki Lambert',
    abstract:
      'Finding the bright stars, planets, and a handful of constellations with no equipment. We will look at seasonal sky maps, how to read a planisphere, and what binoculars can show you on a clear evening.',
  },
  {
    title: 'Sourdough Without the Mystique',
    speaker_name: 'Tobias Reinhart',
    abstract:
      'A no-nonsense routine for keeping a starter alive and baking a reliable loaf each weekend. We will cover hydration, folds, shaping, scoring, and how to read your dough instead of the clock.',
  },
];

db.exec('DELETE FROM comments; DELETE FROM votes; DELETE FROM talks;');
db.exec(
  "DELETE FROM sqlite_sequence WHERE name IN ('talks','votes','comments');"
);

const stmt = db.prepare(
  'INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)'
);
const insertMany = db.transaction((items) => {
  for (const t of items) stmt.run(t.title, t.abstract, t.speaker_name);
});
insertMany(TALKS);

console.log(`Seeded ${TALKS.length} talks.`);
