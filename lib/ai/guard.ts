import "server-only";

// Hardcoded reply for anything that isn't a food-nutrition request. The model
// is scoped to nutrient estimation only; every off-topic path (model returns
// isFood:false, or we detect a non-food question) surfaces this message
// instead of answering. Do NOT let the model free-form here.
export const OFF_TOPIC_MESSAGE =
  "Ovaj asistent služi samo za procjenu nutritivnih vrijednosti hrane. Za ostala pitanja i detalje slobodno pitajte Krešimira.";
