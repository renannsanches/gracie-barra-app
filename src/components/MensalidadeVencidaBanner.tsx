type Props = { texto: string };

export function MensalidadeVencidaBanner({ texto }: Props) {
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-sm">
      <div className="max-w-screen-md mx-auto flex items-center gap-3">
        <div
          className="shrink-0 w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg leading-none"
          aria-hidden="true"
        >
          !
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-900 font-semibold text-[14px] leading-tight">
            Atenção!
          </p>
          <p className="text-amber-800 text-[13px] leading-snug mt-0.5">
            {texto}
          </p>
        </div>
        <a
          href="https://wa.me/14076941856"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium whitespace-nowrap"
        >
          Entrar em contato
        </a>
      </div>
    </div>
  );
}
