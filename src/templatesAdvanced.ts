import type { Set } from './types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function s(weight: number, repsMin: number, repsMax: number): Set {
  return { id: generateId(), weight, reps: 0, repsMin, repsMax };
}

export interface ExerciseOption {
  name: string;
  sets: Set[];
}

export interface MuscleGroup {
  name: string; // ex: "Grand Dorsal", "Biceps"
  options: ExerciseOption[];
}

export interface WorkoutTemplate {
  name: string;
  muscleGroups: MuscleGroup[];
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    name: 'Pull',
    muscleGroups: [
      {
        name: 'Grand Dorsal',
        options: [
          { name: 'Tractions lestées', sets: [s(15, 6, 8), s(15, 6, 8), s(10, 6, 8)] },
          { name: 'Tirage vertical prise grand rond', sets: [s(80, 6, 8), s(80, 6, 8), s(80, 6, 8)] },
          { name: 'Pullover poulie', sets: [s(32.5, 6, 8), s(32.5, 6, 8), s(32.5, 6, 8)] },
          { name: 'Iso-lateral high row', sets: [s(60, 6, 8), s(60, 6, 8), s(55, 6, 8)] },
          { name: 'Vertical traction (pull down)', sets: [s(50, 6, 8), s(50, 6, 8), s(50, 6, 8)] },
          { name: 'Front lat pulldown', sets: [s(40, 6, 8), s(40, 6, 8), s(40, 6, 8)] },
        ],
      },
      {
        name: 'Épaisseur du dos',
        options: [
          { name: 'Tirage horizontal machine unilatérale (row)', sets: [s(60, 6, 8), s(60, 6, 8), s(60, 6, 8)] },
          { name: 'T-bar row', sets: [s(50, 6, 8), s(40, 6, 8), s(40, 6, 8)] },
          { name: 'Tirage horizontal machine (low row)', sets: [s(45, 6, 8), s(45, 6, 8), s(45, 6, 8)] },
          { name: 'Tirage horizontal poulie', sets: [s(75, 6, 8), s(75, 6, 8), s(75, 6, 8)] },
        ],
      },
      {
        name: 'Trapèze/Arrière épaule',
        options: [
          { name: 'Trapèze horizontal (low row)', sets: [s(40, 6, 8), s(35, 6, 8), s(35, 6, 8)] },
          { name: 'Shrugs machine', sets: [s(0, 6, 8), s(0, 6, 8), s(0, 6, 8)] },
          { name: 'Reverse fly', sets: [s(15, 6, 8), s(15, 6, 8), s(15, 6, 8)] },
          { name: 'Upper back', sets: [s(50, 6, 8), s(50, 6, 8), s(50, 6, 8)] },
        ],
      },
      {
        name: 'Biceps',
        options: [
          { name: 'Curl pupitre', sets: [s(32.5, 6, 8), s(32.5, 6, 8), s(32.5, 6, 8)] },
          { name: 'Bayesian curl', sets: [s(12.5, 6, 8), s(12.5, 6, 8), s(12.5, 6, 8)] },
          { name: 'Curl marteau haltères', sets: [s(18, 6, 8), s(18, 6, 8), s(18, 6, 8)] },
          { name: 'Curl marteau uni poulie', sets: [s(12.5, 6, 8), s(12.5, 6, 8), s(12.5, 6, 8)] },
        ],
      },
    ],
  },

  {
    name: 'Push',
    muscleGroups: [
      {
        name: 'Pecs général',
        options: [
          { name: 'Développé couché machine', sets: [s(90, 6, 8), s(90, 6, 8), s(85, 6, 8)] },
          { name: 'Développé couché', sets: [s(80, 6, 8), s(80, 6, 8), s(80, 6, 8)] },
          { name: 'Pec fly', sets: [s(25, 6, 8), s(25, 6, 8), s(25, 6, 8)] },
          { name: 'Chest presse', sets: [s(90, 6, 8), s(90, 6, 8), s(85, 6, 8)] },
        ],
      },
      {
        name: 'Haut pecs',
        options: [
          { name: 'Développé incliné machine hammer strength', sets: [s(80, 6, 8), s(80, 6, 8), s(80, 6, 8)] },
          { name: 'Développé incliné machine', sets: [s(75, 6, 8), s(70, 6, 8), s(70, 6, 8)] },
          { name: 'Smith machine incliné', sets: [s(30, 6, 8), s(30, 6, 8), s(25, 6, 8)] },
          
        ],
      },
      {
        name: 'Bas pecs',
        options: [
          { name: 'Dips corps en avant', sets: [s(140, 6, 8), s(140, 6, 8), s(130, 6, 8)] },
          { name: 'Wide chest press bas des pecs', sets: [s(100, 6, 8), s(100, 6, 8), s(90, 6, 8)] },
        ],
      },
      {
        name: 'Épaules',
        options: [
          { name: 'Développé militaire', sets: [s(22, 6, 8), s(22, 6, 8), s(22, 6, 8)] },
          { name: 'Développé militaire machine', sets: [s(35, 6, 8), s(35, 6, 8), s(32.5, 6, 8)] },
          { name: 'Machine élévation latérale', sets: [s(45, 6, 8), s(40, 6, 8), s(40, 6, 8)] },
          { name: 'Élévation latérale poulie', sets: [s(12.5, 6, 8), s(12.5, 6, 8), s(10, 6, 8)] },
          { name: 'Élévation frontale poulie', sets: [s(7.5, 6, 8), s(7.5, 6, 8), s(7.5, 6, 8)] },

        ],
      },
      {
        name: 'Triceps',
        options: [
          { name: 'Tirage triceps poulie basse corde', sets: [s(17.5, 6, 8), s(17.5, 6, 8), s(17.5, 6, 8)] },
          { name: 'Tirage triceps poulie haute corde', sets: [s(22.5, 6, 8), s(22.5, 6, 8), s(22.5, 6, 8)] },
          { name: 'Barre au front', sets: [s(30, 6, 8), s(30, 6, 8), s(30, 6, 8)] },
          { name: 'Tirage triceps poulie basse triangle', sets: [s(27.5, 6, 8), s(27.5, 6, 8), s(27.5, 6, 8)] },
          { name: 'Tirage triceps poulie haute triangle', sets: [s(35, 6, 8), s(35, 6, 8), s(35, 6, 8)] },
        ],
      },
    ],
  },
  {
    name: 'Legs',
    muscleGroups: [
      {
        name: 'Gros exos',
        options: [
          { name: 'Hack squat', sets: [s(100, 6, 8), s(100, 6, 8), s(100, 6, 8)] },
          { name: 'Deadlift machine', sets: [s(100, 6, 8), s(100, 6, 8), s(100, 6, 8)] },
          { name: 'Hammer V squat', sets: [s(120, 6, 8), s(120, 6, 8), s(120, 6, 8)] },
          { name: 'Presse incline', sets: [s(200, 6, 8), s(200, 6, 8), s(200, 6, 8)] },
          { name: 'Presse ultra incliné', sets: [s(150, 6, 8), s(150, 6, 8), s(150, 6, 8)] },
          { name: 'Squat belt', sets: [s(240, 6, 8), s(240, 6, 8), s(240, 6, 8)] },
          { name: 'Fentes bulgares machine', sets: [s(0, 6, 8), s(0, 6, 8), s(0, 6, 8)] },
        ],
      },
      {
        name: 'Ischio-jambiers',
        options: [
          
          { name: 'Leg curl allongé', sets: [s(45, 6, 8), s(45, 6, 8), s(45, 6, 8)] },
          { name: 'Leg curl assis', sets: [s(55, 6, 8), s(55, 6, 8), s(55, 6, 8)] },
          { name: 'Leg curl debout', sets: [s(30, 6, 8), s(30, 6, 8), s(25, 6, 8)] },
        ],
      },
      {
        name: 'Quads',
        options: [
          { name: 'Machine leg extension', sets: [s(75, 6, 8), s(75, 6, 8), s(75, 6, 8)] },
          { name: 'leg extension poids libres', sets: [s(110, 6, 8), s(110, 6, 8), s(110, 6, 8)] },
          
          
        ],
      },
      {
        name: 'Mollets',
        options: [
          { name: 'Mollet machine assis', sets: [s(50, 6, 8), s(50, 6, 8), s(50, 6, 8)] },
          { name: 'Mollet presse ultra incliné', sets: [s(0, 6, 8), s(0, 6, 8), s(0, 6, 8)] },
          { name: 'Mollet presse horizontal', sets: [s(0, 6, 8), s(0, 6, 8), s(0, 6, 8)] },
        ],
      },
    ],
  },
];
