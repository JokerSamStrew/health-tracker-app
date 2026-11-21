/**
 * Russian labels for the mood catalog.
 *
 * Tags are stored in English as canonical identifiers so backups and existing
 * logs keep working across a language change. Only what the user reads is
 * translated; `moodLabel` falls back to the stored value for custom tags.
 */

import type { Locale } from '../types.ts';
import { translate, type TranslationKey } from './strings.ts';

const MOOD_LABELS_RU: Record<string, string> = {
  // Simple
  Happy: 'Счастливый',
  Sad: 'Грустный',
  Anxious: 'Тревожный',
  Angry: 'Злой',
  Neutral: 'Нейтральный',

  // Detailed
  Amused: 'Развесёлый',
  Apathetic: 'Апатичный',
  Bored: 'Скучающий',
  'Burned out': 'Выгоревший',
  Calm: 'Спокойный',
  Comfortable: 'Комфортно',
  Compassionate: 'Сочувствующий',
  Confident: 'Уверенный',
  Confused: 'Сбитый с толку',
  Connected: 'На связи с людьми',
  Content: 'Довольный',
  Contented: 'Удовлетворённый',
  Curious: 'Любопытный',
  Determined: 'Решительный',
  Disappointed: 'Разочарованный',
  Disheartened: 'Унылый',
  Distracted: 'Рассеянный',
  Drained: 'Истощённый',
  Embarrassed: 'Смущённый',
  Empty: 'Пустой',
  Excited: 'Взволнованный',
  Exhausted: 'Измотанный',
  Fearful: 'Боязливый',
  Focused: 'Сосредоточенный',
  Frustrated: 'Раздражённый',
  Grateful: 'Благодарный',
  Guilty: 'Виноватый',
  Hopeful: 'Надеющийся',
  Hurt: 'Обиженный',
  Impatient: 'Нетерпеливый',
  Indifferent: 'Безразличный',
  Insecure: 'Неуверенный',
  Inspired: 'Вдохновлённый',
  Irritable: 'Раздражительный',
  Isolated: 'Изолированный',
  Jealous: 'Ревнивый',
  Joyful: 'Радостный',
  Lethargic: 'Вялый',
  Lonely: 'Одинокий',
  Loving: 'Любящий',
  Melancholy: 'Меланхоличный',
  Mixed: 'Смешанные чувства',
  Motivated: 'Мотивированный',
  Nostalgic: 'Ностальгирующий',
  Numb: 'Оцепенелый',
  Optimistic: 'Оптимистичный',
  Overstimulated: 'Перегруженный впечатлениями',
  Overwhelmed: 'Подавленный',
  Peaceful: 'Мирный',
  Playful: 'Игривый',
  Productive: 'Продуктивный',
  Proud: 'Гордый',
  Reflective: 'Задумчивый',
  Regretful: 'Сожалеющий',
  Relaxed: 'Расслабленный',
  Resentful: 'Озлобленный',
  Rested: 'Отдохнувший',
  Restless: 'Беспокойный',
  Serene: 'Безмятежный',
  Social: 'Общительный',
  Stressed: 'Под стрессом',
  Surprised: 'Удивлённый',
  Tense: 'Напряжённый',
  Thoughtful: 'Вдумчивый',
  Uncertain: 'Неуверенный',
  Unmotivated: 'Без мотивации',
  Unsettled: 'Неспокойный',
  Vulnerable: 'Уязвимый',
  Withdrawn: 'Замкнутый',
  Worried: 'Озабоченный',

  // Energy
  'High Energy': 'Много энергии',
  Balanced: 'Сбалансированный',
  'Low Energy': 'Мало энергии',
};

const MOOD_GROUP_KEYS: Record<string, TranslationKey> = {
  Simple: 'moodGroup.simple',
  Detailed: 'moodGroup.detailed',
  Energy: 'moodGroup.energy',
};

/** Display label for a stored (canonical English) mood tag. */
export function moodLabel(tag: string, locale: Locale): string {
  if (locale === 'en') return tag;
  return MOOD_LABELS_RU[tag] ?? MOOD_LABELS_RU[tag.toLowerCase()] ?? tag;
}

/** Translated name of a tag group from `MOOD_TAG_GROUPS`. */
export function moodGroupLabel(name: string, locale: Locale, fallback: string): string {
  const key = MOOD_GROUP_KEYS[name];
  return key ? translate(locale, key) : fallback;
}
