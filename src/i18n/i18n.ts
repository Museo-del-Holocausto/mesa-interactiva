import es from '@/content/es/menu.json';
import en from '@/content/en/menu.json';
import { FORCED_LANG } from '@/config/debug';
import type { ContentBundle } from '@/core/types';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/**
 * Un archivo por idioma con la misma forma, no objetos {es, en} anidados:
 * asi el contenido en espanol se edita sin ver una sola clave en ingles.
 */
const BUNDLES: Record<Lang, ContentBundle> = {
  es: es as unknown as ContentBundle,
  en: en as unknown as ContentBundle,
};

const DEFAULT_LANG: Lang = 'es';

function resolve(candidate: string | null): Lang {
  return LANGS.includes(candidate as Lang) ? (candidate as Lang) : DEFAULT_LANG;
}

class I18n {
  private lang: Lang = resolve(FORCED_LANG);

  get current(): Lang {
    return this.lang;
  }

  set(lang: Lang): void {
    this.lang = lang;
    document.documentElement.lang = lang;
  }

  get bundle(): ContentBundle {
    return BUNDLES[this.lang];
  }

  /** Texto de interfaz. Devuelve la clave si falta, para que el hueco se vea. */
  t(key: string): string {
    return this.bundle.ui[key] ?? `[${key}]`;
  }
}

export const i18n = new I18n();
