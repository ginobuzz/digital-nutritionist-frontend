import { PlannedMealDraft } from './plannedMeals';

const MEAL_TYPE_REGEX = /\b(breakfast|lunch|dinner|snack)\b/g;
const MULTI_MEAL_PHRASE_REGEX = /\b(full day|whole day|all day|meal plan|all meals|entire day)\b/;
const MULTI_STEP_PHRASE_REGEX = /\b(then|after|later)\b/;
const NON_WORD_REGEX = /[^a-z0-9\s]/g;
const SPLIT_REGEX = /\s+/;

const STOP_WORDS = new Set([
  'and',
  'the',
  'with',
  'for',
  'from',
  'that',
  'this',
  'into',
  'your',
  'you',
  'want',
  'meal',
  'meals',
  'plan',
  'have',
  'what',
  'eat',
  'drinks',
  'drink',
  'would',
  'like',
]);

const extractMealTypeHints = (input: string): Set<string> => {
  const hints = new Set<string>();
  const normalized = input.toLowerCase();
  const regex = new RegExp(MEAL_TYPE_REGEX.source, MEAL_TYPE_REGEX.flags);
  let match: RegExpExecArray | null = regex.exec(normalized);
  while (match) {
    if (match[1]) hints.add(match[1]);
    match = regex.exec(normalized);
  }
  return hints;
};

const tokenize = (input: string): string[] =>
  input
    .toLowerCase()
    .replace(NON_WORD_REGEX, ' ')
    .split(SPLIT_REGEX)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

export const shouldLimitToSinglePlannedMeal = (input: string): boolean => {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  if (MULTI_MEAL_PHRASE_REGEX.test(normalized)) return false;

  const mealTypeHints = extractMealTypeHints(normalized);
  if (mealTypeHints.size >= 2) return false;

  if (MULTI_STEP_PHRASE_REGEX.test(normalized) && mealTypeHints.size >= 1) return false;
  return true;
};

const scoreDraftRelevance = (draft: PlannedMealDraft, input: string): number => {
  const inputTokens = new Set(tokenize(input));
  if (inputTokens.size === 0) return 0;

  const draftTokens = tokenize(`${draft.name} ${draft.description || ''}`);
  let overlap = 0;
  for (const token of draftTokens) {
    if (inputTokens.has(token)) overlap += 1;
  }

  const mealTypeHints = extractMealTypeHints(input);
  if (mealTypeHints.has(draft.meal_type)) overlap += 2;
  return overlap;
};

const pickMostRelevantDraft = (drafts: PlannedMealDraft[], input: string): PlannedMealDraft =>
  drafts.reduce((best, current) => {
    const bestScore = scoreDraftRelevance(best, input);
    const currentScore = scoreDraftRelevance(current, input);
    if (currentScore > bestScore) return current;
    return best;
  });

export const constrainPlannedMealDraftsToInput = (
  drafts: PlannedMealDraft[],
  input: string
): PlannedMealDraft[] => {
  if (drafts.length <= 1) return drafts;
  if (!shouldLimitToSinglePlannedMeal(input)) return drafts;
  return [pickMostRelevantDraft(drafts, input)];
};
