"use client";

import { useEffect, useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Pestañas en el navegador: el servidor entrega todo el contenido (así la página se puede
 * guardar en caché) y aquí solo se elige qué mostrar. La pestaña se recuerda en la URL (#fases).
 * También acepta el formato antiguo ?vista=fases para no romper enlaces compartidos.
 */
export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [active, setActive] = useState(tabs[0].key);

  useEffect(() => {
    const fromUrl = window.location.hash.slice(1) || new URLSearchParams(window.location.search).get("vista");
    if (fromUrl && tabs.some((t) => t.key === fromUrl)) setActive(fromUrl);
  }, [tabs]);

  const select = (key: string) => {
    setActive(key);
    history.replaceState(null, "", `${window.location.pathname}#${key}`);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex rounded-xl border border-navy-100 bg-white p-1 shadow-[0_8px_24px_-12px_rgb(12_31_63/0.25)]"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => select(t.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 sm:px-4 ${
              active === t.key ? "bg-navy-800 text-white" : "text-navy-500 hover:bg-sky-50 hover:text-navy-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={active !== t.key} className="mt-6">
          {t.content}
        </div>
      ))}
    </>
  );
}
