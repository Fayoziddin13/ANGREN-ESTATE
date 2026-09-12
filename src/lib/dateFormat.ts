/**
 * Format ISO date string into human-readable date
 * Supports uz (Cyrillic default for real estate UI), uz-Latn, and ru
 */
export function formatPublishedDate(
  dateString?: string | null,
  locale: string = "uz",
  short: boolean = false
): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  const uzCyrillicMonths = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
  ];
  const uzCyrillicMonthsShort = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек"
  ];

  const ruMonths = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const ruMonthsShort = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек"
  ];

  const uzLatinMonths = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"
  ];
  const uzLatinMonthsShort = [
    "yan", "fev", "mar", "apr", "may", "iyn",
    "iyl", "avg", "sen", "okt", "noy", "dek"
  ];

  if (locale === "ru") {
    const m = short ? ruMonthsShort[month] : ruMonths[month];
    return `${day} ${m}, ${year}`;
  }

  // Uzbek Cyrillic standard for local Angren market readability
  const m = short ? uzCyrillicMonthsShort[month] : uzCyrillicMonths[month];
  return `${day} ${m}, ${year}`;
}
