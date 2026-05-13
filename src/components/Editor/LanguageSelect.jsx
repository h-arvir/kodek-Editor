import { useEffect, useRef, useState } from 'react';
import '../../styles/Editor/LanguageSelect.css';

export const LanguageSelect = ({ language, setLanguage, languageOptions }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const label = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="lang-select-wrapper" ref={wrapperRef}>
      <button
        className="lang-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        <svg
          className={`lang-select-chevron${open ? ' open' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>

      {open && (
        <div className="lang-select-dropdown" role="listbox">
          {Object.keys(languageOptions).map((lang) => (
            <button
              key={lang}
              role="option"
              aria-selected={lang === language}
              className={`lang-select-option${lang === language ? ' selected' : ''}`}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
            >
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
