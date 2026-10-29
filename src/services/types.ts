import type { NameEntry, NamedList } from "../types";
import type { TypeStoredLang } from "../types/lang-views";
import type { Lang } from "../types";
import { otherLang, pickNameByLang } from "../lib/localize";

export type TypeStored = {
  key: string;
  damageRelations: {
    from: {
      double: string[];
      half: string[];
      none: string[];
    };
    to: {
      double: string[];
      half: string[];
      none: string[];
    };
  };
  localized: {
    en: { name: string | null };
    fr: { name: string | null };
  };
};

function pickNameList(arr: NamedList | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x?.name ?? "")).filter(Boolean);
}

export type TypeRaw = {
  names?: NameEntry[];
  damage_relations?: {
    double_damage_from?: NamedList;
    double_damage_to?: NamedList;
    half_damage_from?: NamedList;
    half_damage_to?: NamedList;
    no_damage_from?: NamedList;
    no_damage_to?: NamedList;
  };
};

export function pickTypeDetails(raw: TypeRaw | null | undefined): Omit<TypeStored, "key"> {
  const dr = raw?.damage_relations ?? {};
  return {
    damageRelations: {
      from: {
        double: pickNameList(dr.double_damage_from),
        half: pickNameList(dr.half_damage_from),
        none: pickNameList(dr.no_damage_from),
      },
      to: {
        double: pickNameList(dr.double_damage_to),
        half: pickNameList(dr.half_damage_to),
        none: pickNameList(dr.no_damage_to),
      },
    },
    localized: {
      en: { name: pickNameByLang(raw?.names, "en") },
      fr: { name: pickNameByLang(raw?.names, "fr") },
    },
  };
}

/**
 * Retourne la structure type pour une seule langue (en ou fr).
 * Si resolveTypeName est fourni, les noms des types dans damage_relations sont traduits.
 */
export function toTypeStoredLang(
  type: TypeStored | null | undefined,
  lang: Lang,
  resolveTypeName?: (apiName: string) => string
): TypeStoredLang | null {
  if (!type) return null;
  const loc = type.localized[lang];
  const fallback = type.localized[otherLang(lang)];
  const name = loc?.name ?? fallback?.name ?? type.key ?? "";

  const from = type.damageRelations.from;
  const to = type.damageRelations.to;
  const resolve = (arr: string[]) =>
    resolveTypeName ? arr.map((id) => resolveTypeName(id) || id) : arr;

  return {
    name,
    damage_relations: {
      double_damage_from: resolve(from.double),
      double_damage_to: resolve(to.double),
      half_damage_from: resolve(from.half),
      half_damage_to: resolve(to.half),
      no_damage_from: resolve(from.none),
      no_damage_to: resolve(to.none),
    },
  };
}
