// types/index.ts
// This file acts as a dictionary for our project's data shapes.
// By defining the 'Persona' type here, we tell TypeScript exactly what properties
// a persona object should have, which helps prevent bugs.
export type Persona = {
  id: string;
  name: string;
  description: string;
  promptFocus: string;
};