# Campo Certo

I'm building a production system for a Brazilian youth football coach who registers roughly 200 athletes per year across several different sports projects (escolinhas). Today he wastes hours before every championship chasing parents on WhatsApp for photos of ID documents and retyping data.

The system has exactly two sides:

1. A PUBLIC registration link (no login, no signup) that he sends to WhatsApp groups. Parents open it on their phone, fill in their child's data, upload a photo of the document, and submit. They never see anyone else's data. They never see a list. Write-only.

2. A PRIVATE admin panel, login required, only for him. Spreadsheet-style view of every athlete, grouped by sports project and by birth year, built so he can copy any single field with one tap and paste it into whatever competition website he's on.

Critical context that drives the whole architecture: this stores CPF, RG, birth dates and document photos of MINORS. Under Brazilian LGPD this is sensitive personal data. The public form must be able to INSERT and nothing else — no SELECT, no UPDATE, no DELETE, no enumeration of records, no way to guess another athlete's URL and read their data. All read access is gated behind authentication.

Stack: React + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS, Edge Functions). Portuguese (pt-BR) interface throughout. Mobile-first on the public form, desktop-dense on the admin panel.

The system must be written in Portuguese. but all sentences and words on the website mustn't include -, ( just like AI genereted Text. 

Build the public route: /cadastro/:slug

Behaviour:

- Loads the projeto by slug. If not found or inativo, show a friendly message in Portuguese, not a stack trace.

- Renders the project logo and name at the top if logo_url exists.

- Single-column, mobile-first, large touch targets, no login, no navigation bar, no links to anywhere else in the app.

FIELDS, in this order:

1. Nome completo do aluno (text, required, min 2 words, auto title-case on blur)

2. Data de nascimento (date, required, native mobile date picker, dd/mm/aaaa display)

3. CPF (text, required, live mask 000.000.000-00, validated with the real check-digit algorithm — not just a length check)

4. RG (text, required)

5. Órgão emissor (text, optional, placeholder "SSP/BA")

6. Nome da mãe (text, optional)

7. Nome do responsável (text, required)

8. Telefone do responsável (text, required, mask (00) 00000-0000)

9. Foto do documento — file input, accept image/* and application/pdf, camera capture enabled on mobile, max 8MB, client-side compression of images above 2MB before upload. Allow up to 2 files (front and back).

VALIDATION:

- CPF check-digit validation with a clear inline error: "CPF inválido, confira os números"

- Birth date must produce an age between 4 and 20. Outside that: "Confira a data de nascimento"

- All errors inline under the field, in plain Portuguese, never a technical message.

DUPLICATE HANDLING — important:

When the CPF already exists in the database, the insert will fail on the unique constraint. Do NOT show a database error and do NOT reveal that the athlete already exists to a random visitor. Handle it through an Edge Function called `submeter-cadastro` that:

- receives the payload,

- upserts on cpf (updating the existing record's fields rather than creating a duplicate),

- returns the same generic success response either way.

The parent always sees the same confirmation. No enumeration.

SUCCESS SCREEN:

Replace the form with a confirmation: the athlete's first name, "Cadastro enviado", and a line saying the data is stored securely and only the coach can see it. Offer a button "Cadastrar outro filho" that resets the form but keeps nome_responsavel and telefone_responsavel prefilled, because siblings are common.

LGPD:

Above the submit button, a short consent checkbox, required:

"Autorizo o uso destes dados exclusivamente para inscrição do meu filho em competições esportivas."

Store the consent timestamp on the athlete record (add a column consentimento_em timestamptz).

The submit button says "Enviar cadastro". After a successful submit it must not be re-clickable.


Build the main admin route: /painel

This is the screen the client will judge the whole project on. It has to feel like a fast spreadsheet, not like a web app with cards.

LAYOUT:

- Left sidebar: list of projetos. Clicking one filters everything.

- Main area: athletes of the selected project, grouped into collapsible sections BY BIRTH YEAR, descending (2015, 2014, 2013...). Each section header shows the year and the count, e.g. "2014 — 17 atletas".

- Inside each section, a dense table. Row height compact. Tabular figures so CPF and dates align vertically down the column.

COLUMNS:

Nome completo | Data de nascimento | CPF | RG | Responsável | Telefone | Documentos | Ações

THE COPY FEATURE — this is the core of the product, build it carefully:

- Every cell containing data is individually clickable to copy. One click copies that single value to the clipboard.

- On click, the cell flashes briefly and a small toast confirms: "CPF copiado".

- CPF and telefone copy UNFORMATTED by default (digits only), because most competition sites reject masked input. Add a toggle in the panel header: "Copiar com máscara" — when on, CPF copies as 000.000.000-00. Remember this preference in localStorage.

- Each row has a "Copiar linha" action that copies all fields tab-separated in column order, so it pastes across a spreadsheet row.

- Each row has a "Copiar em sequência" mode: clicking it enters a stepped state where the first click copies nome, the next click copies data_nascimento, then CPF, then RG — advancing one field per click, with the current field highlighted. This lets him tab through a competition form and paste-click-paste-click without going back to the mouse. Escape exits the mode.

SEARCH:

A single search box at the top that matches across nome_completo (accent-insensitive, partial), CPF (with or without mask), and ano_nascimento. Debounced, results filter live.

DOCUMENTS:

The Documentos column shows a small count. Clicking opens a lightbox with the document images, loaded through 60-second signed URLs. Include a download button.

EDIT:

Clicking the Ações pencil opens a side drawer to edit any field. Save writes back and updates atualizado_em. Include a delete with a typed confirmation, since deleting an athlete is destructive.

EXPORT:

A button per birth-year section: "Exportar 2014" downloads a .xlsx of that group. A global button exports the whole selected project. Columns match the table. Use the sheetjs library.

EMPTY STATE:

When a project has no athletes yet, don't show an empty table. Show the shareable public link for that project with a copy button and a short line: "Envie este link no grupo do WhatsApp. Os cadastros aparecem aqui automaticamente."

Build /painel/projetos

- Create, rename, activate/deactivate projects.

- Upload a logo per project (public bucket is fine for logos — they're not sensitive).

- For each project, display the full public URL and a copy button.

- Also generate a WhatsApp-ready share message with a copy button, something like:

  "Pais e responsáveis, preencham o cadastro do atleta neste link para as inscrições das competições: [URL]"

- Show the athlete count per project.

Design brief. Do not use the default AI look — no cream background, no terracotta accent, no identical rounded cards with soft grey shadows, no all-caps eyebrow labels.

This is a football pitch-side tool used by a coach on a phone in the stands and on a laptop at 11pm before a registration deadline. Ground the visual language in that.

PALETTE:

- Base surface: #0F1A14 (deep pitch green, near-black but unmistakably green)

- Panel surface: #16241C

- Chalk line: #E8EDE9 (primary text, the colour of pitch markings)

- Muted text: #8FA396

- Accent, used only for the copy confirmation and the active state: #F2C14E (a warm amber, the colour of a referee's card)

- Alert: #C4553B

The public parent form inverts this: light background #F7F9F7, dark text, because parents fill it in outdoors in sunlight and a dark form is unreadable on a bright day. That inversion is a deliberate, defensible choice — mention it to the client.

TYPE:

Barlow for body and UI, Barlow Condensed for section headers and the birth-year group titles. Barlow comes from sports and transport signage, it has real condensed weights, and its tabular figures keep CPF columns aligned. One family, two widths, nothing else. Set a clear scale, don't italicise a single word for emphasis.

LAYOUT:

The admin panel is dense on purpose. Rows are 36px. Hairline dividers between rows, not borders around cards. Birth-year group headers are the strongest structural device on the page — they are the thing the coach navigates by.

MOTION:

One place only: the copy confirmation. A 120ms flash on the copied cell and a toast that fades. Nothing else animates. No fade-and-slide-up on sections.

Respect prefers-reduced-motion. Visible keyboard focus rings. The whole panel must be operable by keyboard, because the copy-paste workflow is a keyboard workflow.


1. Test the public form on a 360px viewport.

2. Test the full flow with JavaScript throttled to slow 3G — the form must still submit.

3. Confirm every user-facing string is pt-BR. No leftover English.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4d9830f6-4d0b-4e0b-8fa6-415244a9821d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
