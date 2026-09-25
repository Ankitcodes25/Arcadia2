import type { CSSProperties, ReactNode } from "react";

/* ---------------------------------------------------------
   3D LOGOS  (All Games ke Ludo dice jaise real CSS 3D)
   Styling + animation Allgames.css me .csx3-* classes se aati hai.
   --------------------------------------------------------- */

/* Chess: ghoomta 3D board + sunehra king (2 crossed planes = har angle se 3D dikhta hai) */
function KingPlane({ className, withDefs = false }: { className: string; withDefs?: boolean }) {
  return (
    <svg className={`csx3-king-plane ${className}`} viewBox="13 2 38 56" aria-hidden="true">
      {withDefs && (
        <defs>
          <linearGradient id="csKingGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6c4" />
            <stop offset="1" stopColor="#ffb43a" />
          </linearGradient>
        </defs>
      )}
      <g fill="url(#csKingGold)">
        <rect x="30" y="4" width="4" height="15" rx="1.2" />
        <rect x="25" y="8.5" width="14" height="4" rx="1.2" />
        <path d="M21 34C21 25 25.5 20 32 20S43 25 43 34Z" />
        <rect x="20" y="33" width="24" height="4" rx="2" />
        <path d="M22 37L19 51H45L42 37Z" />
        <rect x="15" y="51" width="34" height="5" rx="2.5" />
      </g>
      <path className="csx3-king-shine" d="M26 26c1.5-3 4-4.4 6-4.6" />
    </svg>
  );
}

function ChessLogo() {
  return (
    <div className="csx3-scene csx3-scene-chess" aria-hidden="true">
      <div className="csx3-tilt">
        <div className="csx3-spin">
          <div className="csx3-board">
            <span className="csx3-side csx3-side-n" />
            <span className="csx3-side csx3-side-s" />
            <span className="csx3-side csx3-side-e" />
            <span className="csx3-side csx3-side-w" />
            <span className="csx3-top" />
          </div>

          <span className="csx3-king-shadow" />

          <div className="csx3-king">
            <KingPlane className="csx3-king-plane-a" withDefs />
            <KingPlane className="csx3-king-plane-b" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* back layer dark purple -> aage wali layer halka purple (Sudoku tile ke liye) */
function layerColor(i: number, total: number) {
  const t = i / (total - 1);
  const from = [74, 31, 138];
  const to = [160, 120, 226];
  const [r, g, b] = from.map((f, k) => Math.round(f + (to[k] - f) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/* Sudoku: 3D tile, digits ek ke baad ek pop hote hain, phir hare (solved) digits, phir green glow */
const TILE_LAYERS = 9;

/* [digit, solved?]  — null = khali cell jo baad me solve hota hai */
const SUDOKU_CELLS: Array<{ digit: number; solved: boolean; color: string }> = [
  { digit: 5, solved: false, color: "#6b37b7" },
  { digit: 3, solved: false, color: "#6b37b7" },
  { digit: 8, solved: true, color: "#0f9f5a" },
  { digit: 6, solved: true, color: "#0f9f5a" },
  { digit: 1, solved: false, color: "#6b37b7" },
  { digit: 4, solved: true, color: "#0f9f5a" },
  { digit: 2, solved: false, color: "#6b37b7" },
  { digit: 9, solved: true, color: "#0f9f5a" },
  { digit: 7, solved: false, color: "#6b37b7" },
];

function SudokuLogo() {
  let givenIndex = 0;
  let solvedIndex = 0;

  return (
    <div className="csx3-scene" aria-hidden="true">
      <span className="csx3-shadow" />
      <div className="csx3-obj csx3-obj-tile">
        {Array.from({ length: TILE_LAYERS }, (_, i) => (
          <div
            key={i}
            className="csx3-tile-layer"
            style={{
              transform: `translateZ(${(i - (TILE_LAYERS - 1) / 2) * 1}px)`,
              background: layerColor(i, TILE_LAYERS),
            }}
          />
        ))}

        <div className="csx3-tile-face">
          {SUDOKU_CELLS.map((cell, k) => {
            const order = cell.solved ? solvedIndex++ : givenIndex++;

            return (
              <span
                key={k}
                className={`csx3-cell ${cell.solved ? "csx3-cell-solved" : ""}`}
                style={{ "--c": cell.color, "--i": order } as CSSProperties}
              >
                <b>{cell.digit}</b>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SMALL ICONS
   --------------------------------------------------------- */

function ClockIcon() {
  return (
    <svg className="coming-soon-clock" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 3h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        className="coming-soon-clock-hand"
        d="M12 13V8.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="coming-soon-lock-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        className="coming-soon-lock-shackle"
        d="M8 11V8a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2.6" fill="rgba(160,90,255,0.18)" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 18v-3.4m0 0l-1.5 1.5m1.5-1.5l1.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------
   DATA
   --------------------------------------------------------- */

type ComingSoonGame = {
  id: string;
  name: string;
  tagline: string;
  logo: ReactNode;
};

const COMING_SOON_GAMES: ComingSoonGame[] = [
  {
    id: "chess",
    name: "Chess",
    tagline: "Think. Plan. Checkmate.",
    logo: <ChessLogo />,
  },
  {
    id: "sudoku",
    name: "Sudoku",
    tagline: "Focus. Solve. Master.",
    logo: <SudokuLogo />,
  },
];

/* ---------------------------------------------------------
   SECTION
   --------------------------------------------------------- */

function ComingSoon() {
  return (
    <section className="coming-soon-section" aria-labelledby="coming-soon-title">
      {/* Header — Arcadion Picks jaisa: kicker + white/purple title + subtitle */}
      <div className="coming-soon-header">
        <div className="coming-soon-eyebrow">COMING SOON</div>

        <h2 id="coming-soon-title">
          NEW <span data-text="GAMES">GAMES</span>
        </h2>

        <p>Something epic is brewing. Stay tuned &mdash; the next set of games will be here soon.</p>
      </div>

      {/* Cards */}
      <div className="coming-soon-games">
        {COMING_SOON_GAMES.map((game) => (
          <article
            className={`coming-soon-card coming-soon-card-${game.id}`}
            key={game.id}
            aria-label={`${game.name} — coming soon`}
          >
            <div className={`coming-soon-art coming-soon-art-${game.id}`} aria-hidden="true" />
            <div className="coming-soon-corners" aria-hidden="true" />

            <span className="coming-soon-pill">
              <ClockIcon />
              COMING SOON
            </span>

            <div className="coming-soon-logo">
              {game.logo}
              <span className="coming-soon-lock" aria-hidden="true">
                <LockIcon />
              </span>
            </div>

            <h3>{game.name}</h3>
            <p>{game.tagline}</p>

            <i className="coming-soon-gem" aria-hidden="true" />
          </article>
        ))}
      </div>

      {/* Footer strip */}
      <div className="coming-soon-footer" aria-hidden="true">
        <span className="coming-soon-footer-line" />
        <i />
        <p>
          MORE GAMES <b>/</b> MORE FUN <b>/</b> SOON
        </p>
        <i />
        <span className="coming-soon-footer-line coming-soon-footer-line-r" />
      </div>
    </section>
  );
}

export default ComingSoon;