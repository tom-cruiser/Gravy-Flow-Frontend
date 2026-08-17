type NetworkLineProps = {
  d: string;
  highlighted?: boolean;
};

export function NetworkLine({ d, highlighted = false }: NetworkLineProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke={highlighted ? 'rgba(230, 230, 230, 0.9)' : 'rgba(140, 140, 140, 0.55)'}
      strokeWidth={highlighted ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={highlighted ? '0' : '6 8'}
      className="drop-shadow-[0_0_12px_rgba(255,255,255,0.12)]"
    />
  );
}
