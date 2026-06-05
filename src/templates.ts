import type { Workout, Exercise, Set } from './types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function s(weight: number, reps: number): Set {
  return { id: generateId(), weight, reps };
}

function ex(name: string, sets: Set[]): Exercise {
  return { id: generateId(), name, sets };
}

export const WORKOUT_TEMPLATES: Omit<Workout, 'id' | 'date'>[] = [
  {
    name: 'Pull 1',
    exercises: [
      ex('Tractions lestées', [s(15, 0), s(15, 0), s(10, 0)]),
      ex('Tirage vertical prise grand rond', [s(80, 0), s(80, 0), s(80, 0)]),
      ex('Iso-lateral high row', [s(60, 0), s(60, 0), s(55, 0)]),
      ex('Pullover poulie', [s(32.5, 0), s(32.5, 0), s(32.5, 0)]),
      ex('Tirage horizontal machine unilatérale (row)', [s(60, 0), s(60, 0), s(60, 0)]),
      ex('Trapèze horizontal (low row)', [s(40, 0), s(35, 0), s(35, 0)]),
      ex('Shrugs machine', [s(0, 0), s(0, 0), s(0, 0)]),
      ex('Curl pupitre', [s(32.5, 0), s(32.5, 0), s(32.5, 0)]),
      ex('Bayesian curl', [s(12.5, 0), s(12.5, 0), s(12.5, 0)]),
      ex('Reverse fly', [s(15, 0), s(15, 0), s(15, 0)]),
      ex('Upper back', [s(50, 0), s(50, 0), s(50, 0)]),
    ],
  },
  {
    name: 'Pull 2',
    exercises: [
      ex('Vertical traction (pull down)', [s(50, 0), s(50, 0), s(50, 0)]),
      ex('Front lat pulldown', [s(40, 0), s(40, 0), s(40, 0)]),
      ex('T-bar row', [s(50, 0), s(40, 0), s(40, 0)]),
      ex('Tirage horizontal machine (low row)', [s(45, 0), s(45, 0), s(45, 0)]),
      ex('Tirage horizontal poulie', [s(75, 0), s(75, 0), s(75, 0)]),
      ex('Reverse fly', [s(15, 0), s(15, 0), s(15, 0)]),
      ex('Upper back', [s(50, 0), s(50, 0), s(50, 0)]),
      ex('Curl marteau haltères', [s(18, 0), s(18, 0), s(18, 0)]),
      ex('Curl marteau uni poulie', [s(12.5, 0), s(12.5, 0), s(12.5, 0)]),
      ex('Curl pupitre', [s(32.5, 0), s(32.5, 0), s(32.5, 0)]),
      ex('Bayesian curl', [s(12.5, 0), s(12.5, 0), s(12.5, 0)]),
    ],
  },
  {
    name: 'Push 1',
    exercises: [
      ex('Développé couché machine', [s(90, 0), s(90, 0), s(85, 0)]),
      ex('Pec fly', [s(25, 0), s(25, 0), s(25, 0)]),
      ex('Chest presse', [s(90, 0), s(90, 0), s(85, 0)]),
      ex('Développé incliné machine hammer strength', [s(80, 0), s(80, 0), s(80, 0)]),
      ex('Smith machine incliné', [s(30, 0), s(30, 0), s(25, 0)]),
      ex('Dips corps en avant', [s(140, 0), s(140, 0), s(130, 0)]),
      ex('Développé militaire', [s(22, 0), s(22, 0), s(22, 0)]),
      ex('Machine élévation latérale', [s(45, 0), s(40, 0), s(40, 0)]),
      ex('Élévation latérale poulie', [s(12.5, 0), s(12.5, 0), s(10, 0)]),
      ex('Tirage triceps poulie basse corde', [s(17.5, 0), s(17.5, 0), s(17.5, 0)]),
      ex('Tirage triceps poulie haute corde', [s(22.5, 0), s(22.5, 0), s(22.5, 0)]),
    ],
  },
  {
    name: 'Push 2',
    exercises: [
      ex('Développé militaire machine', [s(35, 0), s(35, 0), s(32.5, 0)]),
      ex('Développé incliné machine', [s(75, 0), s(70, 0), s(70, 0)]),
      ex('Smith machine incliné', [s(30, 0), s(30, 0), s(25, 0)]),
      ex('Wide chest press bas des pecs', [s(100, 0), s(100, 0), s(90, 0)]),
      ex('Dips corps en avant', [s(140, 0), s(140, 0), s(130, 0)]),
      ex('Machine élévation latérale', [s(45, 0), s(40, 0), s(40, 0)]),
      ex('Élévation latérale poulie', [s(12.5, 0), s(12.5, 0), s(10, 0)]),
      ex('Élévation frontale poulie', [s(7.5, 0), s(7.5, 0), s(7.5, 0)]),
      ex('Barre au front', [s(30, 0), s(30, 0), s(30, 0)]),
      ex('Tirage triceps poulie basse triangle', [s(27.5, 0), s(27.5, 0), s(27.5, 0)]),
      ex('Tirage triceps poulie haute triangle', [s(35, 0), s(35, 0), s(35, 0)]),
    ],
  },
  {
    name: 'Legs',
    exercises: [
      ex('Hack squat', [s(100, 0), s(100, 0), s(100, 0)]),
      ex('Hammer V squat', [s(120, 0), s(120, 0), s(120, 0)]),
      ex('Deadlift machine', [s(100, 0), s(100, 0), s(100, 0)]),
      ex('Presse incline', [s(200, 0), s(200, 0), s(200, 0)]),
      ex('Presse ultra incliné', [s(150, 0), s(150, 0), s(150, 0)]),
      ex('Squat belt', [s(240, 0), s(240, 0), s(240, 0)]),
      ex('Fentes bulgares machine', [s(0, 0), s(0, 0), s(0, 0)]),
      ex('Machine leg extension', [s(75, 0), s(75, 0), s(75, 0)]),
      ex('Machine leg extension poids libres', [s(110, 0), s(110, 0), s(110, 0)]),
      ex('Leg curl allongé', [s(45, 0), s(45, 0), s(45, 0)]),
      ex('Leg curl assis', [s(55, 0), s(55, 0), s(55, 0)]),
      ex('Leg curl debout', [s(30, 0), s(30, 0), s(25, 0)]),
      ex('Mollet machine assis', [s(50, 0), s(50, 0), s(50, 0)]),
      ex('Mollet presse ultra incliné', [s(0, 0), s(0, 0), s(0, 0)]),
      ex('Mollet presse horizontal', [s(0, 0), s(0, 0), s(0, 0)]),
    ],
  },
];
