// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Usam currentColor, então herdam a cor do texto.

export function ExcavatorIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* esteira */}
      <rect x="1" y="17" width="13" height="4" rx="2" />
      {/* cabine / corpo */}
      <path d="M4 16v-4.5A2.5 2.5 0 0 1 6.5 9H9l1.6 3.2V16H4Z" />
      {/* lança e braço */}
      <path d="M10.4 9.6 18.8 6l1.1 2.1-5.6 3.3 4.2 4.7-1.6 1.5-6.5-7.5Z" />
      {/* caçamba */}
      <path d="M17.6 16.2l3.3.7-.5 2.5-3.4-.8a1.7 1.7 0 0 1 .6-2.4Z" />
    </svg>
  );
}

export function RollerIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* rolo dianteiro */}
      <circle cx="6" cy="15.5" r="5.5" />
      {/* corpo */}
      <path d="M11.5 11h5.5a2 2 0 0 1 2 2v3.5h-7.5V11Z" />
      {/* cabine */}
      <path d="M12.8 6h3.2l1.2 4.5h-5.6L12.8 6Z" />
      {/* roda traseira */}
      <circle cx="18.5" cy="17.5" r="3.2" />
    </svg>
  );
}
