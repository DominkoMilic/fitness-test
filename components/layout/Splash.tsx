// Server-rendered splash. Visible from first byte of HTML until React
// hydrates (~when JS bundle parses + executes). Inline <style> so it
// renders without globals.css being parsed.
//
// Hidden by SplashHider (client) on mount. Falls back to a 6 s safety
// fade via inline <script> in case hydration never fires (e.g. JS error).

export function Splash() {
  return (
    <>
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
@keyframes kf-splash-spin { to { transform: rotate(360deg); } }
@keyframes kf-splash-pulse { 0%, 100% { opacity: .7 } 50% { opacity: 1 } }
#kf-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: linear-gradient(160deg, #1b3255 0%, #0e1e36 100%);
  color: #fff;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  transition: opacity .35s ease-out;
}
#kf-splash.kf-splash-hide { opacity: 0; pointer-events: none; }
#kf-splash .kf-splash-ring {
  position: relative;
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
#kf-splash .kf-splash-ring::before,
#kf-splash .kf-splash-ring::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 4px solid rgba(255,255,255,0.15);
}
#kf-splash .kf-splash-ring::after {
  border-color: transparent;
  border-top-color: #fff;
  animation: kf-splash-spin .9s linear infinite;
}
#kf-splash .kf-splash-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background: #ff7a1a;
}
#kf-splash .kf-splash-title {
  font-size: .875rem;
  font-weight: 800;
  letter-spacing: .025em;
}
#kf-splash .kf-splash-sub {
  font-size: .75rem;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  animation: kf-splash-pulse 1.6s ease-in-out infinite;
}
          `,
        }}
      />
      <div id="kf-splash" aria-hidden="true">
        <div className="kf-splash-ring">
          <span className="kf-splash-dot" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div className="kf-splash-title">Krešimir Fit</div>
          <div className="kf-splash-sub">Učitavam...</div>
        </div>
      </div>
      <script
        // Safety net: remove splash after 6s even if hydration never fires.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
setTimeout(function(){
  var el = document.getElementById('kf-splash');
  if (el) { el.classList.add('kf-splash-hide'); setTimeout(function(){ el.remove(); }, 400); }
}, 6000);
          `,
        }}
      />
    </>
  );
}
