/**
 * k-anonymity floor for sensitive aggregates (wellbeing pulses, triage outcomes): a block's
 * numbers are only shown once at least K_ANON different devices have contributed, so a single
 * household's answers can't be read off the map.
 */
export const K_ANON = 5
