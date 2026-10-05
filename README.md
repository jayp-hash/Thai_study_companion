# Thai Study Companion

A web app for learning Thai, built around the words people actually use most.

I live in Bangkok and started learning Thai in a classroom. The lessons were fine, but practice at home was the hard part. Most apps either teach random travel phrases or make you memorize lists with no context. I wanted something that starts with the most common words, shows them in real sentences, and lets you hear them spoken by a Thai voice. So I'm building it.

I spent about 15 years in English teaching and EdTech (including a digital platform launch for 2.5 million learners in China), so this is also a chance to build the kind of learning product I used to manage, this time hands-on.

## What works today

- **Vocabulary flashcards.** 896 words, ordered by how common they are, in sets of 20. Tap to flip, press play to hear the word, arrow keys to move through the set. Example sentences sit on the back of the card.
- **Thai audio.** Every word can be played aloud using ElevenLabs text-to-speech.
- **A real database.** Words, sentences and the links between them live in Supabase (Postgres), loaded from a curriculum spreadsheet by an import script.

Sentence Patterns, Sentence Structures and Activities are designed but not built yet. They show as "Coming soon" on the home page.

## Where the content comes from

The word list is my own. I cross-referenced three Thai word-frequency lists, kept the top 500 words, and added the classifiers and function words (แก้ว, ใบ, กี่, หน่อย and so on) that show up in basic sentences but miss the frequency lists. That gives 896 words. Older versions of the CU-TFL (Chulalongkorn University's Test of Thai as a Foreign Language) are a reference for what a learner should be able to do at each level, so the course works toward a real goal.

Sentences come from my curriculum spreadsheet. Some were drafted with AI help for the most common words, and every sentence carries a review status (unreviewed, needs native review, approved, rejected). Rejected sentences never reach the app.

## Product decisions

A few choices that shaped the app, and why:

- **Practice by speech style, not "pick your gender".** Thai speakers end sentences with ครับ (khrap) or ค่ะ/คะ (kha) and use different words for "I". The app will ask which style you want to practice. Sentences are stored once, in a neutral form, and the right particles are swapped in when the page loads. Each sentence is tagged as a statement or a question, because that decides ค่ะ versus คะ.
- **Flashcards teach the textbook version.** Casual Thai often differs from the textbook. Example: เรา is often glossed as "we", but in everyday speech it is closer to an informal "I". The cards use the safe, correct form (พวกเรา for "we"). The gaps are being collected for a future "Real Talk vs Textbook" section.
- **ElevenLabs over Google for audio.** I compared Thai voices from Google Cloud, Botnoi and ElevenLabs by ear. ElevenLabs sounded the most natural. It needs the eleven_v3 model, the only one that actually supports Thai. After listening tests across several stability settings, the flashcards use the "Amy" voice at 0.3.
- **Numbers are generated, not written.** Practice sentences with numbers will get random numbers that scale with level (1 to 10 early on, up to 100 and beyond later), so learners can't just memorize the answer.
- **A placement test, not a fixed start.** New users can take an optional test: chunks of 5 questions per level, move up after 3 out of 5, get a fresh chunk after a miss, and stop after two misses at the same level.
- **Built for real situations.** The longer-term goal is role-play practice for moments like asking 7-Eleven staff if they take credit cards, not just repeating sentences.

## How it's built

| Part | Tool | Why |
| --- | --- | --- |
| Website | Next.js 14 (React) | One codebase for pages and the small server functions behind them |
| Database | Supabase (Postgres) | SQL tables for words and sentences, with row-level security |
| Audio | ElevenLabs API | The most natural Thai voices I tested |
| Hosting | Vercel | Deploys the site from this repo |
| Content | Excel workbook + Node import script | The spreadsheet stays the source of truth, so content edits never touch code |

**The data model**, in plain terms:

- `vocabulary`: one row per word (Thai, romanization, English, frequency rank)
- `sentences`: one row per example sentence, with its type and review status
- `word_sentences`: a link table, since one sentence contains many words and one word appears in many sentences

Row-level security means the public website can only **read** these tables. Only the import script, running on my own computer with a private key, can write to them. The vocabulary page refreshes from the database at most once an hour, so new content appears without redeploying the site.

## Known issues

- **Audio consistency.** The same word can come out with slightly different pacing or pitch between generations. The plan is to generate each word once, check it, and store the file instead of generating audio live.
- **The audio endpoint is open.** `/api/speak` will turn any text into speech. Before wider release it needs limits so nobody can run up the ElevenLabs bill.

## Roadmap

1. Lock down `/api/speak` and pre-generate approved audio for every word
2. Sentence Patterns and Sentence Structures sections, including common-mistake examples
3. The ครับ/ค่ะ speech-style switch
4. Survival Thai: visas, banking, landlords, doctors, driving
5. Placement test
6. Accounts, progress tracking and spaced repetition
7. Role-play practice for real situations

## Run it locally

```bash
npm install
cp .env.example .env.local   # then add your own Supabase and ElevenLabs keys
npm run dev                  # opens at http://localhost:3000
```

To load content, create the tables by running `supabase/001_vocabulary_and_sentences.sql` in the Supabase SQL editor, then run:

```bash
node scripts/import-curriculum.js path/to/your-workbook.xlsx
```

Keys go in `.env.local`, which is never committed (see `.gitignore`). On Vercel they are set as encrypted environment variables.

## About me

I'm Jason Pshyk, a strategy and operations lead with an MBA and a PMP, based in Bangkok. This is a side project I build in my spare time, with Claude as a coding partner.
