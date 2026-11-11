import { useState, useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { store } from "./planner.js";

export const INSTALL_KEY = "amberly.install.v1"; // true once the grower closes the card

// Chrome on Android announces "this site can be installed" once, often before the
// screen is drawn, so we catch it here and keep it for the Install button.
let installEvent = null;
let notify = () => {};
const setInstallEvent = (e) => { installEvent = e; notify(); };
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); setInstallEvent(e); });
window.addEventListener("appinstalled", () => setInstallEvent(null));
const subscribe = (fn) => { notify = fn; return () => { notify = () => {}; }; };

// A card on the first screen that shows how to keep Amberly on the Home Screen.
// Phones only, never once installed, and gone for good once closed.
export default function InstallTip() {
  const canInstall = useSyncExternalStore(subscribe, () => installEvent);
  const [closed, setClosed] = useState(() => store.get(INSTALL_KEY, false));

  const installed = navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  // iPads say they are Macs, so a "Mac" with a touch screen counts too.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent) && canInstall;
  if (closed || installed || !(ios || android)) return null;

  const install = async () => {
    canInstall.prompt();
    await canInstall.userChoice;
    setInstallEvent(null); // the browser lets each offer be used once
  };

  return (
    <div className="tv-install">
      <button className="tv-install-x" aria-label="Close" onClick={() => { store.set(INSTALL_KEY, true); setClosed(true); }}>
        <Icon name="close" size={20} />
      </button>
      <div className="tv-install-title">Keep Amberly on your Home Screen</div>
      {ios ? (
        <>
          <p>It opens like an app and works with no signal. It also stops Safari from clearing your grows after a week away.</p>
          <ol>
            <li>Tap <Icon name="share" /> <b>Share</b> in your browser</li>
            <li>Tap <Icon name="add" /> <b>Add to Home Screen</b></li>
          </ol>
        </>
      ) : (
        <>
          <p>It opens like an app and works with no signal.</p>
          <button className="tv-btn tv-btn-primary" onClick={install}>Install Amberly</button>
        </>
      )}
    </div>
  );
}
