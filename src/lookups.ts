import { cached } from "./lib/cache";
import { otherLang } from "./lib/localize";
import { listTypes } from "./repositories/catalog";
import type { Lang } from "./types/common";

/**
 * Table nom API -> nom affiché pour une langue, construite une fois par langue
 * (avant : tous les types étaient relus et parsés à chaque requête /moves et /type).
 */
const typeNamesByLang = cached((lang: Lang) => {
  const map = new Map<string, string>();
  for (const { name, type } of listTypes()) {
    if (!type?.localized) continue;
    map.set(
      name.toLowerCase(),
      type.localized[lang]?.name ?? type.localized[otherLang(lang)]?.name ?? name
    );
  }
  return map;
});

/** Renvoie une fonction qui traduit le nom API d'un type dans la langue demandée. */
export function getTypeNameResolver(lang: Lang): (apiName: string) => string {
  const map = typeNamesByLang(lang);
  return (apiName) => map.get(apiName.toLowerCase()) ?? apiName;
}
