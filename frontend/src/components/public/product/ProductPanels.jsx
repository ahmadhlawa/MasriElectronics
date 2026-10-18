import { useState } from "react";
import useMediaQuery from "../../../hooks/useMediaQuery.js";

/**
 * Description / specifications / delivery. Tabs where there is room for them,
 * accordions on a phone — same content, same order, no duplicated markup.
 */
export default function ProductPanels({ panels }) {
  const compact = useMediaQuery("(max-width: 899px)");
  const [openTab, setOpenTab] = useState(panels[0]?.key);
  const [openSet, setOpenSet] = useState(() => new Set([panels[0]?.key]));

  if (!panels.length) return null;

  if (compact) {
    return (
      <div className="vs-accordion">
        {panels.map((panel) => {
          const open = openSet.has(panel.key);
          return (
            <div className="vs-accordion__item" key={panel.key}>
              <h2>
                <button
                  type="button"
                  className="vs-accordion__trigger"
                  aria-expanded={open}
                  aria-controls={`vs-panel-${panel.key}`}
                  onClick={() =>
                    setOpenSet((current) => {
                      const next = new Set(current);
                      if (next.has(panel.key)) next.delete(panel.key);
                      else next.add(panel.key);
                      return next;
                    })
                  }
                >
                  {panel.label}
                  <span className="vs-accordion__mark" aria-hidden="true">
                    {open ? "−" : "+"}
                  </span>
                </button>
              </h2>
              {open && (
                <div className="vs-accordion__body" id={`vs-panel-${panel.key}`}>
                  {panel.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="vs-tabs">
      <div className="vs-tabs__list" role="tablist" aria-label="معلومات المنتج">
        {panels.map((panel) => (
          <button
            key={panel.key}
            type="button"
            role="tab"
            id={`vs-tab-${panel.key}`}
            aria-selected={openTab === panel.key}
            aria-controls={`vs-panel-${panel.key}`}
            tabIndex={openTab === panel.key ? 0 : -1}
            className="vs-tabs__tab"
            onClick={() => setOpenTab(panel.key)}
            onKeyDown={(event) => {
              const position = panels.findIndex((item) => item.key === panel.key);
              const next = event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1
                : event.key === "ArrowLeft" ? (position + 1) % panels.length
                  : event.key === "ArrowRight" ? (position - 1 + panels.length) % panels.length : null;
              if (next === null) return;
              event.preventDefault();
              setOpenTab(panels[next].key);
              event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
            }}
          >
            {panel.label}
          </button>
        ))}
      </div>
      {panels.map((panel) =>
        openTab === panel.key ? (
          <div
            key={panel.key}
            role="tabpanel"
            id={`vs-panel-${panel.key}`}
            aria-labelledby={`vs-tab-${panel.key}`}
            className="vs-tabs__panel"
            tabIndex={0}
          >
            {panel.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
