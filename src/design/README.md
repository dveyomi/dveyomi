# Design system

One design system for the whole app, built for a phone first with a separately designed desktop layout. It has two themes that share every token name: **light** (the default: off-white background, white cards, near-black text, grey secondary text) and **dark** (near-black background, charcoal cards, white text, muted grey secondary text). Both use one restrained lime accent and rounded shapes.

## Themes

`tokens.css` holds two colour sets:

| Selector | When it applies |
| --- | --- |
| `:root` (the block with `color-scheme: light`) | Light, the default: no cookie, `theme=light`, or an invalid value |
| `:root[data-theme="dark"]` | Dark, chosen in Settings |
| `:root[data-theme="system"]` inside `@media (prefers-color-scheme: dark)` | Match device, while the device prefers dark. It is a copy of the dark block; a test fails if they differ |

Type, spacing, radii and layout tokens are shared and sit in their own `:root` block. Colours and elevation (`--shadow-*`, `--scrim`) differ per theme. Each theme sets `color-scheme`, so native controls and scrollbars match.

The choice lives in the `theme` cookie (`light`, `dark` or `system`; one year, `path=/`, `SameSite=Lax`). `src/lib/theme.ts` holds the helpers. An inline script in the root layout's `<head>` reads the cookie and sets `<html data-theme>` before first paint, so no page shows the wrong theme, and pages stay static. The Settings Theme card and the `/design` gallery use `ThemeChooser`, which changes `data-theme` and the cookie at once, with no reload. It reads its selection from `<html data-theme>` (via `useSyncExternalStore`), so it always shows what the page really uses, even after back/forward; the server value only seeds the server render. Match device follows the OS setting live through the media query.

## Fill vs foreground colours

Bright lime is unreadable on white, so each accent and status colour comes in two roles:

| Fill (backgrounds) | Foreground (text, icons, strokes, bars, focus rings on bg and card) |
| --- | --- |
| `--accent` (`bg-accent`): primary button, selected chip, desktop + button | `--accent-fg` (`text-accent-fg`, `stroke-accent-fg`, `outline-accent-fg`): lime in dark, deep olive in light |
| `--danger`, `--warning`, `--positive` (`bg-danger`, tints such as `bg-danger/15`) | `--danger-fg`, `--warning-fg`, `--positive-fg` |
| text on a fill: `--accent-ink` (`text-accent-ink`) | |

Rule: a fill token never colours text, icons, strokes, outlines or borders. `tokens.test.ts` fails on `text-accent`, `stroke-danger`, `outline-accent`, `border-danger` and similar. In dark each `-fg` value equals its fill, so the dark theme looks the same.

Contrast is tested in both themes: text and muted are at least 4.5:1 on bg, card and card-raised; every `-fg` is at least 4.5:1 on bg and card; `--accent-ink` is at least 4.5:1 on `--accent`; `--border-strong` is at least 3:1 on card and card-raised.

## Adding a colour token

1. Add it to the light `:root` block **and** to `:root[data-theme="dark"]`. Copy the dark line into the `[data-theme="system"]` block inside the media query too.
2. Map it in `src/app/globals.css` under `@theme inline` (`--color-name: var(--name);`).
3. If it is a foreground, add it to the contrast tests in `tokens.test.ts`. If it is a fill that needs text on it, add a `-fg` partner or an ink token.
4. Add a swatch to the Colour section of `/design`, then check both themes with the switch at the top.

## Rules

1. **To change a colour or a size, edit `src/design/tokens.css`.** It is the only place colours, type sizes, spacing, radii and elevation are defined.
2. **To change how a component looks, edit its file in `src/components/ui/`.** Components accept only semantic props such as `variant`, `tone` and `state`. They never take colour or size strings. `className` is accepted only where layout needs it (spacing and grid placement), and never for colour.
3. **Never style a screen directly.** Screens compose components from `@/components/ui` and lay them out with Tailwind's layout and spacing utilities. Screens contain no hex colours, pixel values, inline colour styles or one-off component styles.
4. Money is always shown with `<Money pence={…} />`. It formats through `formatGBP` and uses tabular numerals. Amounts are entered with `<AmountInput />`, which parses through `parsePence`.

`src/design/tokens.test.ts` enforces rules 1 and 3 for every file under `src/app/` and `src/components/`. It fails on:

- hex colour literals;
- `rgb()`, `hsl()` and `oklch()` colour functions;
- arbitrary pixel Tailwind values such as `w-[13px]`;
- pixel literals in CSS;
- `style={{…}}` objects that contain a colour or a pixel value;
- any `var(--x)` that `tokens.css` does not define.

## How tokens reach Tailwind

`src/app/globals.css` imports `tokens.css` and maps each token into Tailwind's theme with `@theme inline` and `var(--token)`. It also clears Tailwind's default colours, font sizes, radii and shadows, so only tokens can be used.

| Token | Utilities |
| --- | --- |
| `--bg`, `--card`, `--card-raised`, `--text`, `--muted`, `--accent`, `--accent-ink`, `--accent-fg`, `--danger`, `--danger-fg`, `--warning`, `--warning-fg`, `--positive`, `--positive-fg`, `--border`, `--border-strong`, `--scrim` | `bg-*`, `text-*`, `border-*`, `stroke-*`, etc. (e.g. `bg-card`, `text-muted`) |
| `--text-display` 40px, `--text-title` 20px, `--text-body` 16px, `--text-caption` 13px | `text-display`, `text-title`, `text-body`, `text-caption` |
| `--font-sans` | `font-sans` |
| `--space-1` (4px step) | every spacing utility: `p-4` is `4 × --space-1`, which equals `--space-4` |
| `--radius-sm` 8px, `--radius-md` 16px, `--radius-pill` | `rounded-sm`, `rounded-md`, `rounded-pill` |
| `--shadow-sheet`, `--shadow-float` | `shadow-sheet`, `shadow-float` |
| `--width-phone` 390px | `max-w-phone` |

Tailwind also writes self-referencing copies such as `--text-display: var(--text-display)` into its `theme` layer. Those copies have no effect, because `tokens.css` is not in any layer and unlayered declarations win. The `/design` page confirms that the real values apply.

## Components

All components are exported from `@/components/ui`:

`Button`, `ButtonLink` (a link that looks like a Button), `IconButton`, `Card`, `ProgressBar`, `Gauge`, `Badge`, `StatusBadge`, `Money`, `Notice` (tinted callout: danger, warning, neutral), `AmountInput`, `TextField`, `Select`, `Toggle`, `SegmentedTabs` (switch views; tablist), `RadioSegments` (pick one setting; radiogroup; arrows, Home and End), `Skeleton` (placeholder while request-time content streams in), `BottomSheet`, `ConfirmDialog`, `ListRow`, `EmptyState`, `Chip`, `Icon` (a single inline SVG set, where `IconName` is a string union).

`/design` is a living gallery that shows every token and every component in each of its variants and states, at phone width (390) and at desktop width. A theme switch at the top shows it in light, dark or the device's setting. It is available only in development: in production it returns `notFound()`.

## References

The following Mobbin screens informed layout and pattern choices only. Nothing is copied from any app, and the reference app's screenshots remain the visual guide.

| Pattern | Phone (iOS) | Desktop (web) |
| --- | --- | --- |
| Gauge | [Neo Financial: goal arc gauge with figure in centre](https://mobbin.com/screens/1133e05b-80c4-4b9b-b0f1-74df2c07c3c0) | [Revolut: analytics cards with headline figure](https://mobbin.com/screens/9b019468-ba9a-4943-884e-70ec2479eaef) |
| Progress bar | [Copilot: category spent vs budget bars, red when over](https://mobbin.com/screens/8fcfa6a7-f247-4a53-ab29-bab4255199bd) | [Webflow: usage card with full-width bar](https://mobbin.com/screens/834099db-be3d-4751-bfb4-005f9eea2a7d) |
| Amount entry | [Lightyear: large amount with tabular figures](https://mobbin.com/screens/1c82bc8f-c6b1-450f-9dc4-a412dca470da) | [Fresha: amount field with currency prefix in a form card](https://mobbin.com/screens/6e63ea8d-9469-4582-b496-6f93d1555885) |
| Bottom sheet / dialog | [Aave: dark rounded bottom sheet with close button](https://mobbin.com/screens/2e25bf46-83f5-4eee-b9ac-fc01b8f87e38) | [Meetup: centred "Record expense" modal](https://mobbin.com/screens/d38a7cbe-8f19-44b9-8a5f-8eda22ad2f29) |
| Calendar | [Lightyear: dated event list](https://mobbin.com/screens/9949ee8e-90d7-4ec5-a721-e823204135e0) | [Revolut: day-by-day spending axis](https://mobbin.com/screens/9b019468-ba9a-4943-884e-70ec2479eaef) |
| List rows | [Lightyear: transaction rows with icon, subtitle and signed amount](https://mobbin.com/screens/402552aa-1295-465c-b24c-280430475fae) | [Revolut: transaction list card with detail panel](https://mobbin.com/screens/51527f45-6904-459c-bb96-1c244b9f23fb) |

The reference results also settled several token values:

- **Large figures:** around 40px, set in tabular numerals.
- **Corner radii:** 16px on cards and pill-shaped buttons.
- **Card surfaces:** charcoal cards on a near-black background (Phantom and Aave in dark mode); in light, white cards on an off-white background.
- **Over-budget state:** shown in red by filling the bar completely (Copilot).
