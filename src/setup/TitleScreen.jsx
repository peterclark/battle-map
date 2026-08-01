// The title plate. Original artwork, in the same grimdark register as the
// rest of the app: a ridge line of spears and banners against a low sun.
const TitleBanner = () => (
  <svg
    viewBox="0 0 480 150"
    className="block h-auto w-full"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ef9f27" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ef9f27" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="368" cy="62" r="70" fill="url(#sun)" opacity="0.35" />
    <circle cx="368" cy="62" r="20" fill="#ef9f27" opacity="0.85" className="animate-flicker" />
    {[
      28, 44, 60, 76, 92, 150, 166, 182, 198, 262, 278, 294, 420, 436, 452,
    ].map((x, index) => (
      <g key={x}>
        <line
          x1={x}
          y1={68 + ((index * 7) % 17)}
          x2={x}
          y2={120}
          stroke="#0a0806"
          strokeWidth="2.2"
        />
        <polygon
          points={`${x - 3},${74 + ((index * 7) % 17)} ${x},${62 + ((index * 7) % 17)} ${x + 3},${74 + ((index * 7) % 17)}`}
          fill="#0a0806"
        />
      </g>
    ))}
    {[
      { x: 118, color: "#521b1b" },
      { x: 228, color: "#26221d" },
      { x: 330, color: "#521b1b" },
    ].map(({ x, color }) => (
      <g key={x}>
        <line x1={x} y1="52" x2={x} y2="120" stroke="#0a0806" strokeWidth="3" />
        <path
          d={`M${x} 52 L${x + 34} 58 L${x + 26} 68 L${x + 34} 78 L${x} 84 Z`}
          fill={color}
          stroke="#0a0806"
          strokeWidth="1.2"
        />
      </g>
    ))}
    <path
      d="M0 112 L54 104 L118 110 L196 100 L282 108 L360 102 L438 108 L480 103 L480 150 L0 150 Z"
      fill="#0d0b08"
    />
    <path
      d="M0 128 Q80 120 160 126 T320 124 T480 127 L480 150 L0 150 Z"
      fill="#080706"
    />
  </svg>
);

export default function TitleScreen({ onStart }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-iron-900 px-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <TitleBanner />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-6xl font-bold uppercase tracking-[0.18em] text-ember-400 sm:text-7xl">
            BattleMap
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-bone-500">
            A war table for two. March your regiments with your hands; when they
            meet, the table works out the attack.
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="plate plate-on-ember px-14 py-4 font-display text-xl font-bold uppercase tracking-[0.3em] text-ember-300 animate-ember-pulse"
        >
          Start
        </button>

        <p className="pb-6 text-center text-[10px] leading-snug text-bone-500">
          Unit cards and combat rules from{" "}
          <span className="text-bone-300">Battleground: Fantasy Warfare</span> by
          Your Move Games.
        </p>
      </div>
    </div>
  );
}
