// The 12 word categories and their colours.
//
// The NAMES must match the "Category" dropdown in the curriculum workbook
// (Vocabulary tab, list kept on the "Lists" tab). To rename a category,
// change it in both places, then re-run the import.
//
// color = the card's band and play button; edge = the darker "3D" edge
// under buttons. Picked so all 12 are easy to tell apart.
export const CATEGORIES = {
  'People & animals':   { color: '#E8604C', edge: '#B8442F' },
  'Food & drink':       { color: '#F08A1C', edge: '#B9640A' },
  'Time & dates':       { color: '#2B86E8', edge: '#1D62AE' },
  'Places & position':  { color: '#21A867', edge: '#16794A' },
  'Actions':            { color: '#8B5CF6', edge: '#6439C9' },
  'Describing words':   { color: '#E2488F', edge: '#AE2F6A' },
  'Numbers & counting': { color: '#11A79A', edge: '#0B7A70' },
  'Question words':     { color: '#D9A400', edge: '#A07800' },
  'Grammar words':      { color: '#4F5BD5', edge: '#353FA6' },
  'Things & objects':   { color: '#B0743F', edge: '#82532A' },
  'Body & health':      { color: '#E04848', edge: '#AA2E2E' },
  'Work & society':     { color: '#5F6B80', edge: '#434C5C' },
};

// Words with no category (or a misspelled one) get a neutral band.
const FALLBACK = { color: '#5F6B80', edge: '#434C5C' };

export function categoryFor(name) {
  const c = CATEGORIES[name];
  return { name: c ? name : 'Vocabulary', ...(c || FALLBACK) };
}
