/**
 * Cross-references a cocktail's ingredient list against the Stock Orders
 * product list to decide if the venue has everything for it. Built against
 * the venue's actual stock (categories like "Gin"/"Vodka"/"Whisky" hold many
 * brands; specific liqueurs/syrups/mixers live under "Other Spirits",
 * "Syrups", "Soft Drinks", "Garnish & Others") — not a generic fuzzy match,
 * since that would either miss obvious matches or false-positive constantly.
 *
 * An ingredient the dictionary doesn't recognise doesn't block the tick —
 * better to under-claim confidence on an odd ingredient than make every
 * cocktail with an unusual mixer look unavailable.
 */
export type StockHaystack = { categories: Set<string>; products: string };

export function buildHaystack(rows: { category: string; product: string }[]): StockHaystack {
  return {
    categories: new Set(rows.map((r) => r.category.trim().toLowerCase())),
    products: rows.map((r) => r.product.toLowerCase()).join(" | "),
  };
}

type Test = (h: StockHaystack) => boolean;
const cat = (name: string): Test => (h) => h.categories.has(name);
const prod = (substr: string): Test => (h) => h.products.includes(substr);
const anyOf = (...tests: Test[]): Test => (h) => tests.some((t) => t(h));
const never: Test = () => false;
const always: Test = () => true;

const RULES: { pattern: RegExp; test: Test }[] = [
  { pattern: /\bgin\b/, test: cat("gin") },
  { pattern: /\bvodka\b/, test: cat("vodka") },
  { pattern: /\b(white|dark|spiced|aged|golden|coconut)?\s*rum\b/, test: cat("rum") },
  { pattern: /\btequila\b/, test: prod("tequila") },
  { pattern: /\bmezcal\b/, test: never },
  { pattern: /\b(whisk(e)?y|bourbon|scotch|rye)\b/, test: cat("whisky") },
  { pattern: /\b(brandy|cognac|armagnac)\b/, test: cat("cognac/ armagnac") },
  { pattern: /\bcalvados\b/, test: prod("calvados") },
  { pattern: /\bvermouth\b/, test: prod("martini") },
  { pattern: /\bcampari\b/, test: prod("campari") },
  { pattern: /\baperol\b/, test: prod("aperol") },
  { pattern: /\b(cointreau|triple sec|cura[cç]ao)\b/, test: anyOf(prod("cointreau"), prod("marnier")) },
  { pattern: /\bgran[d]?\s*marnier\b/, test: prod("marnier") },
  { pattern: /\bbaileys\b/, test: prod("baileys") },
  { pattern: /\bchambord\b/, test: prod("chambord") },
  { pattern: /\b(kahlua|coffee liqueur)\b/, test: prod("kahlua") },
  { pattern: /\b(amaretto|disaronno)\b/, test: prod("disaronno") },
  { pattern: /\b(st\.?\s?germain|elderflower liqueur)\b/, test: prod("st germain") },
  { pattern: /\blimoncello\b/, test: prod("limoncello") },
  { pattern: /\bsambuca\b/, test: prod("sambuca") },
  { pattern: /\bjagermeister\b/, test: prod("jagermeister") },
  { pattern: /\b(pernod|pastis)\b/, test: prod("pernod") },
  { pattern: /\bdrambuie\b/, test: prod("drambuie") },
  { pattern: /\bb[ée]n[ée]dictine\b/, test: prod("benedictine") },
  { pattern: /\b(cherry heering|heering)\b/, test: prod("heering") },
  { pattern: /\bmidori\b/, test: prod("midori") },
  { pattern: /\bpimm'?s\b/, test: prod("pimms") },
  { pattern: /\bsouthern comfort\b/, test: prod("southern comfort") },
  { pattern: /\bchartreuse\b/, test: never },
  { pattern: /\bmaraschino liqueur\b/, test: always },
  { pattern: /\bfalernum\b/, test: never },
  { pattern: /\bsuze\b/, test: never },
  { pattern: /\blillet\b/, test: never },
  { pattern: /\b(sugar syrup|simple syrup|gomme)\b/, test: prod("gomme") },
  { pattern: /\bhoney\b/, test: always },
  { pattern: /\b(cr[eè]me de cassis|cassis)\b/, test: prod("cassis") },
  { pattern: /\bgrenadine\b/, test: prod("grenadine") },
  { pattern: /\borgeat\b/, test: prod("orgeat") },
  { pattern: /raspberry.*syrup/, test: prod("framboise") },
  { pattern: /strawberry.*syrup/, test: prod("fraise") },
  { pattern: /\bpassion\s?fruit\b/, test: anyOf(prod("passionfruit"), prod("passoa")) },
  { pattern: /\bvanilla\b/, test: prod("vanilla") },
  { pattern: /\b(cream of coconut|coconut cream)\b/, test: prod("coconut") },
  { pattern: /\bcaramel\b/, test: prod("caramel") },
  { pattern: /\btonic\b/, test: prod("tonic") },
  { pattern: /\bsoda water\b/, test: prod("soda") },
  { pattern: /\bginger beer\b/, test: prod("ginger beer") },
  { pattern: /\bginger ale\b/, test: prod("ginger ale") },
  { pattern: /\b(cola|coke)\b/, test: prod("coca cola") },
  { pattern: /\bcranberry\b/, test: prod("cranberry") },
  { pattern: /\bpineapple juice\b/, test: prod("pineapple") },
  { pattern: /\borange juice\b/, test: prod("orange juice") },
  { pattern: /\bapple juice\b/, test: prod("apple juice") },
  { pattern: /\blime cordial\b/, test: prod("lime cordial") },
  { pattern: /\belderflower cordial\b/, test: prod("elderflower") },
  { pattern: /\bclamato\b/, test: never },
  { pattern: /\bworcester(shire)? sauce\b/, test: prod("worcester") },
  { pattern: /\b(hot sauce|tabasco)\b/, test: prod("tabasco") },
  { pattern: /\bangostura\b/, test: prod("angostura") },
  { pattern: /\b(maraschino cherr(y|ies)|cocktail cherr(y|ies))\b/, test: prod("cocktail cherries") },
  { pattern: /\bchampagne\b/, test: anyOf(prod("bollinger"), prod("henriot"), prod("laurent perrier"), prod("taittinger"), prod("krug")) },
  { pattern: /\bprosecco\b/, test: prod("prosecco") },
  { pattern: /\b(dry white wine|white wine|red wine|ros[eé] wine|dry sparkling wine)\b/, test: always },
];

/** null = ingredient not recognised, doesn't count against the cocktail. */
export function ingredientAvailable(ingredient: string, haystack: StockHaystack): boolean | null {
  const lower = ingredient.toLowerCase();
  for (const rule of RULES) {
    if (rule.pattern.test(lower)) return rule.test(haystack);
  }
  return null;
}

export function cocktailInStock(ingredients: string[], haystack: StockHaystack): boolean {
  return ingredients.every((ing) => ingredientAvailable(ing, haystack) !== false);
}
