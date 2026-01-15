import simplePage from './primitives/simple-page.json';
import inputStates from './primitives/input-states.json';
import buttonVariants from './primitives/button-variants.json';

export const primitives = {
  'simple-page': JSON.stringify(simplePage, null, 2),
  'input-states': JSON.stringify(inputStates, null, 2),
  'button-variants': JSON.stringify(buttonVariants, null, 2)
};
